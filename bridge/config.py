from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "onwK4e9ZLuTAKqWW03F9"  # Daniel — dramatic sports commentator

    VIRTUALS_API_KEY: str = ""
    VIRTUALS_AGENT_ID: str = ""

    SOLANA_RPC_URL: str = "https://api.devnet.solana.com"
    BRIDGE_KEYPAIR_PATH: str = "~/.config/solana/id.json"
    PROGRAM_ID: str = "7xStH3SCRkztTc1SWQtcx9ACvwqaYyUJF35dTbpAZG2S"

    WEBOTS_HOST: str = "127.0.0.1"
    WEBOTS_PORT: int = 5005

    class Config:
        env_file = ".env"


settings = Settings()
