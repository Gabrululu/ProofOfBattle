"""
Solana service — signs and sends transactions to the Proof of Battle Anchor program.
Uses anchorpy for typed account deserialization.
"""
import json
import logging
from pathlib import Path

from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solana.rpc.async_api import AsyncClient
from anchorpy import Provider, Wallet, Program, Idl, Context

log = logging.getLogger(__name__)

IDL_PATH = Path(__file__).parent.parent / "idl" / "proof_of_battle.json"
SYS_PROGRAM = Pubkey.from_string("11111111111111111111111111111111")


class SolanaService:
    def __init__(self, rpc_url: str, keypair_path: str):
        self._rpc_url = rpc_url
        self._keypair_path = Path(keypair_path).expanduser()
        self._client: AsyncClient | None = None
        self._program: Program | None = None
        self._wallet: Wallet | None = None
        self._mock = False  # True when IDL or keypair is unavailable

    async def _ensure_program(self):
        if self._program is not None or self._mock:
            return
        try:
            from config import settings
            if settings.BRIDGE_KEYPAIR_JSON:
                secret = json.loads(settings.BRIDGE_KEYPAIR_JSON)
            else:
                with open(self._keypair_path) as f:
                    secret = json.load(f)
            keypair = Keypair.from_bytes(bytes(secret))
            self._wallet = Wallet(keypair)

            self._client = AsyncClient(self._rpc_url)
            provider = Provider(self._client, self._wallet)

            with open(IDL_PATH) as f:
                raw_idl = json.load(f)
            idl = Idl.from_json(raw_idl)
            self._program = Program(idl, provider=provider)
        except FileNotFoundError as e:
            log.warning("Solana mock mode — missing file: %s", e)
            self._mock = True
        except Exception as e:
            log.warning("Solana mock mode — init failed: %s", e)
            self._mock = True

    # ─── PDA helpers ─────────────────────────────────────────────────────────

    def _battle_pda(self, battle_id: int) -> tuple[Pubkey, int]:
        battle_bytes = battle_id.to_bytes(8, "little")
        return Pubkey.find_program_address(
            [b"battle", battle_bytes],
            self._program.program_id,
        )

    def _vault_pda(self, battle_id: int) -> tuple[Pubkey, int]:
        battle_bytes = battle_id.to_bytes(8, "little")
        return Pubkey.find_program_address(
            [b"vault", battle_bytes],
            self._program.program_id,
        )

    def _robot_pda(self, owner: Pubkey, name: str) -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"robot", bytes(owner), name.encode()],
            self._program.program_id,
        )

    # ─── Transactions ─────────────────────────────────────────────────────────

    async def register_robot(
        self, name: str, attack: int, defense: int, speed: int
    ) -> str:
        await self._ensure_program()
        if self._mock:
            log.info("[MOCK] register_robot name=%s atk=%d def=%d spd=%d", name, attack, defense, speed)
            return "mock_tx"
        robot_pda, _ = self._robot_pda(self._wallet.public_key, name)
        tx = await self._program.rpc["register_robot"](
            name, attack, defense, speed,
            ctx=Context(accounts={
                "robot": robot_pda,
                "owner": self._wallet.public_key,
                "system_program": SYS_PROGRAM,
            })
        )
        log.info("register_robot(%s) tx: %s", name, tx)
        return str(tx)

    async def create_battle(
        self,
        battle_id: int,
        entry_fee: int,
        robot_a_name: str,
        robot_b_name: str,
    ) -> str:
        await self._ensure_program()
        if self._mock:
            log.info("[MOCK] create_battle id=%d", battle_id)
            return "mock_tx"
        battle_pda, _ = self._battle_pda(battle_id)
        vault_pda, _ = self._vault_pda(battle_id)
        robot_a_pda, _ = self._robot_pda(self._wallet.public_key, robot_a_name)
        robot_b_pda, _ = self._robot_pda(self._wallet.public_key, robot_b_name)
        tx = await self._program.rpc["create_battle"](
            battle_id, entry_fee,
            ctx=Context(accounts={
                "battle": battle_pda,
                "vault": vault_pda,
                "robot_a": robot_a_pda,
                "robot_b": robot_b_pda,
                "creator": self._wallet.public_key,
                "system_program": SYS_PROGRAM,
            })
        )
        log.info("create_battle(%d) tx: %s", battle_id, tx)
        return str(tx)

    async def start_battle(self, battle_id: int) -> str:
        await self._ensure_program()
        if self._mock:
            log.info("[MOCK] start_battle id=%d", battle_id)
            return "mock_tx"
        battle_pda, _ = self._battle_pda(battle_id)
        tx = await self._program.rpc["start_battle"](
            battle_id,
            ctx=Context(accounts={
                "battle": battle_pda,
                "authority": self._wallet.public_key,
            })
        )
        log.info("start_battle(%d) tx: %s", battle_id, tx)
        return str(tx)

    async def resolve_battle(self, arena_id: int, winner_side: int) -> str:
        await self._ensure_program()
        if self._mock:
            log.info("[MOCK] resolve_battle arena=%d winner=%d", arena_id, winner_side)
            return "mock_tx"
        battle_pda, _ = self._battle_pda(arena_id)
        account = await self._program.account["battle"].fetch(battle_pda)
        tx = await self._program.rpc["resolve_battle"](
            arena_id, winner_side,
            ctx=Context(accounts={
                "battle": battle_pda,
                "robot_a": account.robot_a,
                "robot_b": account.robot_b,
                "authority": self._wallet.public_key,
            })
        )
        log.info("resolve_battle(arena=%d, winner=%d) tx: %s", arena_id, winner_side, tx)
        return str(tx)

    async def report_damage(
        self,
        arena_id: int,
        target: str,
        damage: int,
        hit_description: str = "",
    ) -> str:
        await self._ensure_program()

        if self._mock:
            target_u8 = 0 if target == "robot_a" else 1
            log.info("[MOCK] report_damage arena=%d target=%d damage=%d", arena_id, target_u8, damage)
            return "mock_tx"

        battle_pda, _ = self._battle_pda(arena_id)
        target_u8 = 0 if target == "robot_a" else 1

        tx = await self._program.rpc["report_damage"](
            arena_id,
            target_u8,
            damage,
            ctx=Context(
                accounts={
                    "battle": battle_pda,
                    "authority": self._wallet.public_key,
                }
            ),
        )
        log.info("report_damage tx: %s", tx)
        return str(tx)

    # ─── Reads ────────────────────────────────────────────────────────────────

    async def fetch_robot_state(self, owner: str, name: str) -> dict | None:
        """Fetch wins/losses/hp for a registered robot. Returns None on failure."""
        await self._ensure_program()
        if self._mock:
            return None
        try:
            owner_pubkey = Pubkey.from_string(owner)
            robot_pda, _ = self._robot_pda(owner_pubkey, name)
            account = await self._program.account["robot"].fetch(robot_pda)
            return {
                "wins":      account.wins,
                "losses":    account.losses,
                "hp":        account.hp,
                "is_active": account.is_active,
            }
        except Exception:
            return None

    async def fetch_match_state(self, arena_id: int) -> dict:
        await self._ensure_program()

        if self._mock:
            return {"arena_id": arena_id, "hp_a": 100, "hp_b": 100, "status": "Active"}

        battle_pda, _ = self._battle_pda(arena_id)
        try:
            account = await self._program.account["battle"].fetch(battle_pda)
            return {
                "arena_id": arena_id,
                "hp_a": account.hp_a,
                "hp_b": account.hp_b,
                "status": list(account.status.__dict__.keys())[0].capitalize(),
                "winner": account.winner,
                "total_bets_a": account.total_bets_a,
                "total_bets_b": account.total_bets_b,
                "robot_a": str(account.robot_a),
                "robot_b": str(account.robot_b),
            }
        except Exception as e:
            log.error("Could not fetch battle state: %s", e)
            return {"arena_id": arena_id, "hp_a": 100, "hp_b": 100, "status": "Unknown"}
