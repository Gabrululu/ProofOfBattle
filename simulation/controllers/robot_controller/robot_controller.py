"""
Proof of Battle — Webots supervisor controller.

Runs as ROBOT_A with `supervisor TRUE`.
- Controls ROBOT_A via its own device API (motors, GPS, compass, touch sensors).
- Controls ROBOT_B kinematically via Supervisor.Node.setVelocity() — no separate
  controller needed for ROBOT_B (controller "<none>" in arena.wbt).
- Serves a TCP socket on :5005 so the Python bridge can receive collision events
  and send action commands.
"""
import json
import math
import random
import socket
from controller import Supervisor  # type: ignore[import-untyped]

BRIDGE_HOST  = "127.0.0.1"
BRIDGE_PORT  = 5005
ARENA_ID     = 1
MAX_SPEED    = 5.0    # rad/s — ROBOT_A wheel motors
MAX_LINEAR   = 0.40  # m/s   — ROBOT_B kinematic speed cap
HIT_DIST     = 0.44  # m     — proximity that triggers a collision event
HIT_COOLDOWN = 45    # sim steps before the same attacker can hit again
STUN_STEPS   = 30    # sim steps the struck robot is stunned


class St:
    ADVANCE = "advance"
    ATTACK  = "attack"
    STUNNED = "stunned"
    DEAD    = "dead"


class BattleArena:

    # ── Initialisation ───────────────────────────────────────────────────────

    def __init__(self):
        self.supervisor = Supervisor()
        self.dt = int(self.supervisor.getBasicTimeStep())

        self._init_robot_a()
        self._init_robot_b()
        self._init_tcp()

        self.hp       = {"robot_a": 100, "robot_b": 100}
        self.state    = {"robot_a": St.ADVANCE, "robot_b": St.ADVANCE}
        self.cooldown = {"robot_a": 0, "robot_b": 0}
        self.stun     = {"robot_a": 0, "robot_b": 0}
        self._buf     = b""
        self._conn: socket.socket | None = None
        self.active   = True

    def _init_robot_a(self):
        g = self.supervisor.getDevice

        self.motors_a = [g("robot_a_left_motor"), g("robot_a_right_motor")]
        for m in self.motors_a:
            m.setPosition(float("inf"))
            m.setVelocity(0.0)

        self.touch_a = [g("robot_a_touch_front"), g("robot_a_touch_rear")]
        for s in self.touch_a:
            s.enable(self.dt)

        self.gps_a = g("robot_a_gps")
        self.gps_a.enable(self.dt)

        self.compass_a = g("robot_a_compass")
        self.compass_a.enable(self.dt)

    def _init_robot_b(self):
        # Supervisor can access ROBOT_B's node to read position and set velocity
        self.rb = self.supervisor.getFromDef("ROBOT_B")

    def _init_tcp(self):
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind((BRIDGE_HOST, BRIDGE_PORT))
        srv.listen(1)
        srv.setblocking(False)
        self._srv = srv
        print(f"[Arena] TCP bridge listening on {BRIDGE_HOST}:{BRIDGE_PORT}")

    # ── TCP I/O ──────────────────────────────────────────────────────────────

    def _try_accept(self):
        try:
            self._conn, addr = self._srv.accept()
            self._conn.setblocking(False)
            print(f"[Arena] Bridge connected from {addr}")
        except BlockingIOError:
            pass

    def _read_msgs(self) -> list[dict]:
        if not self._conn:
            return []
        try:
            data = self._conn.recv(4096)
            if data:
                self._buf += data
        except BlockingIOError:
            pass
        except (ConnectionResetError, BrokenPipeError):
            self._conn = None
            return []
        out = []
        while b"\n" in self._buf:
            line, self._buf = self._buf.split(b"\n", 1)
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
        return out

    def _send(self, msg: dict):
        if not self._conn:
            return
        try:
            self._conn.sendall((json.dumps(msg) + "\n").encode())
        except (BrokenPipeError, ConnectionResetError):
            self._conn = None

    # ── Position helpers ─────────────────────────────────────────────────────

    def _pos_a(self) -> tuple[float, float]:
        v = self.gps_a.getValues()
        return v[0], v[2]

    def _pos_b(self) -> tuple[float, float]:
        p = self.rb.getPosition()
        return p[0], p[2]

    def _dist(self) -> float:
        ax, az = self._pos_a()
        bx, bz = self._pos_b()
        return math.hypot(ax - bx, az - bz)

    # ── Drive helpers ────────────────────────────────────────────────────────

    def _drive_a(self, left: float, right: float):
        clamp = lambda v: max(-MAX_SPEED, min(MAX_SPEED, v))
        self.motors_a[0].setVelocity(clamp(left))
        self.motors_a[1].setVelocity(clamp(right))

    def _steer_a_toward(self, tx: float, tz: float, spd: float = 1.0):
        """P-controller: steer ROBOT_A toward world (tx, tz)."""
        ax, az   = self._pos_a()
        target   = math.atan2(tx - ax, tz - az)
        north    = self.compass_a.getValues()
        heading  = math.atan2(north[0], north[2])
        err = target - heading
        err = (err + math.pi) % (2 * math.pi) - math.pi  # wrap to ±π
        turn  = max(-MAX_SPEED, min(MAX_SPEED, err * 4.0))
        speed = MAX_SPEED * spd
        self._drive_a(speed - turn, speed + turn)

    def _drive_b(self, forward: float, omega: float):
        """Set ROBOT_B velocity in world frame (kinematic control via supervisor)."""
        orient = self.rb.getOrientation()  # row-major 3×3
        # Column 0 of R = local +X direction in world coords
        fx, fz = orient[0], orient[6]
        n = math.hypot(fx, fz)
        if n > 1e-4:
            fx, fz = fx / n, fz / n
        self.rb.setVelocity([fx * forward, 0.0, fz * forward, 0.0, omega, 0.0])

    def _steer_b_toward(self, tx: float, tz: float, spd: float = 1.0):
        """P-controller: steer ROBOT_B toward world (tx, tz) via setVelocity."""
        bx, bz = self._pos_b()
        dx, dz = tx - bx, tz - bz
        if math.hypot(dx, dz) < 0.01:
            self._drive_b(0.0, 0.0)
            return
        target = math.atan2(dx, dz)
        orient = self.rb.getOrientation()
        cur    = math.atan2(orient[0], orient[6])
        err    = target - cur
        err = (err + math.pi) % (2 * math.pi) - math.pi
        omega   = max(-5.0, min(5.0, err * 5.0))
        forward = MAX_LINEAR * spd * (1.0 if abs(err) < 0.4 else 0.25)
        self._drive_b(forward, omega)

    # ── Collision detection ──────────────────────────────────────────────────

    def _check_hits(self):
        d = self._dist()

        if d < HIT_DIST:
            for attacker, target in [("robot_a", "robot_b"), ("robot_b", "robot_a")]:
                if self.cooldown[attacker] > 0 or self.state[attacker] == St.DEAD:
                    continue

                dmg = random.randint(8, 22)
                self.hp[target] = max(0, self.hp[target] - dmg)
                self.cooldown[attacker] = HIT_COOLDOWN
                if self.state[target] != St.DEAD:
                    self.stun[target]  = STUN_STEPS
                    self.state[target] = St.STUNNED

                evt = {
                    "type": "collision",
                    "arena_id": ARENA_ID,
                    "attacker": attacker,
                    "target": target,
                    "damage": dmg,
                    "description": f"Ram! {attacker} hits {target} for {dmg} damage",
                }
                self._send(evt)
                print(f"[HIT] {attacker} → {target}  {dmg} dmg | "
                      f"A:{self.hp['robot_a']} B:{self.hp['robot_b']}")

                if self.hp[target] <= 0 and self.state[target] != St.DEAD:
                    self.state[target] = St.DEAD
                    self.active = False
                    self._send({"type": "match_over", "arena_id": ARENA_ID, "winner": attacker})
                    print(f"\n🏆  {attacker.upper()} WINS!  Battle over.")

        for k in ("robot_a", "robot_b"):
            if self.cooldown[k] > 0:
                self.cooldown[k] -= 1

    # ── Per-robot state machine tick ─────────────────────────────────────────

    def _tick_a(self):
        bx, bz = self._pos_b()
        d  = self._dist()
        st = self.state["robot_a"]

        if st == St.DEAD:
            self._drive_a(0.0, 0.0)

        elif st == St.STUNNED:
            # Back away briefly
            self._drive_a(-MAX_SPEED * 0.45, -MAX_SPEED * 0.45)
            self.stun["robot_a"] -= 1
            if self.stun["robot_a"] <= 0:
                self.state["robot_a"] = St.ADVANCE

        elif st == St.ADVANCE:
            if d < 0.75:
                self.state["robot_a"] = St.ATTACK
            else:
                self._steer_a_toward(bx, bz, spd=0.70)

        elif st == St.ATTACK:
            if d > 1.2:
                self.state["robot_a"] = St.ADVANCE
            else:
                self._steer_a_toward(bx, bz, spd=1.0)

    def _tick_b(self):
        ax, az = self._pos_a()
        d  = self._dist()
        st = self.state["robot_b"]

        if st == St.DEAD:
            self._drive_b(0.0, 0.0)

        elif st == St.STUNNED:
            self._drive_b(-MAX_LINEAR * 0.45, 0.0)
            self.stun["robot_b"] -= 1
            if self.stun["robot_b"] <= 0:
                self.state["robot_b"] = St.ADVANCE

        elif st == St.ADVANCE:
            if d < 0.75:
                self.state["robot_b"] = St.ATTACK
            else:
                self._steer_b_toward(ax, az, spd=0.65)

        elif st == St.ATTACK:
            if d > 1.2:
                self.state["robot_b"] = St.ADVANCE
            else:
                self._steer_b_toward(ax, az, spd=0.90)

    # ── Bridge message handler ────────────────────────────────────────────────

    def _handle(self, msg: dict):
        t = msg.get("type")

        if t == "command":
            rid   = msg.get("robot_id", "robot_a")
            act   = msg.get("action", "idle")
            inten = float(msg.get("intensity", 0.5))
            spd   = MAX_SPEED * inten
            moves = {
                "move_forward":  ( spd,  spd),
                "move_backward": (-spd, -spd),
                "attack":        (MAX_SPEED, MAX_SPEED),
                "boost":         (MAX_SPEED, MAX_SPEED),
                "rotate_left":   (-spd,  spd),
                "rotate_right":  ( spd, -spd),
                "brake":         (0.0, 0.0),
                "idle":          (0.0, 0.0),
            }
            l, r = moves.get(act, (0.0, 0.0))
            if rid == "robot_a":
                self._drive_a(l, r)
            elif rid == "robot_b":
                fwd = MAX_LINEAR * inten * (1 if l > 0 else -1) if act != "idle" else 0.0
                self._drive_b(fwd, 0.0)

        elif t == "sensor_request":
            rid  = msg.get("robot_id", "robot_a")
            ax, az = self._pos_a()
            bx, bz = self._pos_b()
            px, pz = (ax, az) if rid == "robot_a" else (bx, bz)
            self._send({
                "robot_id": rid,
                "position": {"x": round(px, 3), "y": round(pz, 3)},
                "heading_deg": 0.0,
                "hp": self.hp[rid],
                "enemy_distance": round(self._dist(), 3),
                "enemy_bearing_deg": None,
                "collision_front": False,
                "collision_rear": False,
            })

    # ── Main loop ─────────────────────────────────────────────────────────────

    def run(self):
        print("[Arena] Settling physics (3 s)...")
        for _ in range(94):   # 94 × 32 ms ≈ 3 s
            self.supervisor.step(self.dt)

        print("[Arena] FIGHT!")
        tick = 0

        while self.supervisor.step(self.dt) != -1:
            if not self._conn:
                self._try_accept()

            for msg in self._read_msgs():
                self._handle(msg)

            if self.active:
                self._tick_a()
                self._tick_b()
                self._check_hits()

            # Sensor broadcast to bridge every 20 ticks (~640 ms)
            if tick % 20 == 0:
                ax, az = self._pos_a()
                bx, bz = self._pos_b()
                self._send({
                    "type": "sensor_update",
                    "arena_id": ARENA_ID,
                    "robot_a": {"hp": self.hp["robot_a"],
                                "position": {"x": round(ax, 3), "y": round(az, 3)}},
                    "robot_b": {"hp": self.hp["robot_b"],
                                "position": {"x": round(bx, 3), "y": round(bz, 3)}},
                })
            tick += 1


if __name__ == "__main__":
    BattleArena().run()
