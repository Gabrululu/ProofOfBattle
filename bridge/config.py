from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "onwK4e9ZLuTAKqWW03F9"

    VIRTUALS_API_KEY: str = ""
    VIRTUALS_AGENT_ID: str = ""

    SOLANA_RPC_URL: str = "https://api.devnet.solana.com"
    BRIDGE_KEYPAIR_PATH: str = "~/.config/solana/id.json"
    # Alternative: pass the raw JSON bytes array as a string, e.g. "[1,2,3,...]"
    # Takes priority over BRIDGE_KEYPAIR_PATH when set.
    BRIDGE_KEYPAIR_JSON: str = ""
    PROGRAM_ID: str = "9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP"

    WEBOTS_HOST: str = "127.0.0.1"
    WEBOTS_PORT: int = 5005
    # Set this to use WebSocket mode instead of raw TCP.
    # Format: wss://xyz.trycloudflare.com  (Cloudflare tunnel)
    #      or ws://host:port               (local ws_bridge.py)
    # When set, WEBOTS_HOST/PORT are ignored for the main connection.
    WEBOTS_WS_URL: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
