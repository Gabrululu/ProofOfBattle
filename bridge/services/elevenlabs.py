"""ElevenLabs integration: speech-to-text transcription and TTS commentary."""
import base64
import logging
import tempfile
from pathlib import Path

import httpx

from config import settings

log = logging.getLogger(__name__)

STT_URL = "https://api.elevenlabs.io/v1/speech-to-text"
TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"


class ElevenLabsService:
    def __init__(self, api_key: str):
        self._headers = {"xi-api-key": api_key}
        self._client = httpx.AsyncClient(timeout=30)

    async def transcribe_base64(self, audio_b64: str) -> str:
        """Transcribe base64-encoded audio (webm/mp4) to text."""
        audio_bytes = base64.b64decode(audio_b64)
        return await self._transcribe_bytes(audio_bytes)

    async def transcribe_file(self, path: Path) -> str:
        audio_bytes = path.read_bytes()
        return await self._transcribe_bytes(audio_bytes)

    async def _transcribe_bytes(self, audio_bytes: bytes) -> str:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        try:
            with open(tmp_path, "rb") as f:
                resp = await self._client.post(
                    STT_URL,
                    headers=self._headers,
                    files={"file": ("audio.webm", f, "audio/webm")},
                    data={"model_id": "scribe_v1"},
                )
            resp.raise_for_status()
            return resp.json().get("text", "")
        except httpx.HTTPStatusError as e:
            log.error("ElevenLabs STT error: %s", e.response.text)
            return ""
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    async def generate_commentary(self, text: str) -> str:
        """Generate dramatic battle commentary. Returns base64-encoded mp3."""
        url = TTS_URL.format(voice_id=settings.ELEVENLABS_VOICE_ID)
        payload = {
            "text": text,
            "model_id": "eleven_turbo_v2_5",
            "voice_settings": {
                "stability": 0.35,
                "similarity_boost": 0.85,
                "style": 0.6,
                "use_speaker_boost": True,
            },
        }
        try:
            resp = await self._client.post(url, headers=self._headers, json=payload)
            resp.raise_for_status()
            return base64.b64encode(resp.content).decode()
        except httpx.HTTPStatusError as e:
            log.error("ElevenLabs TTS error: %s", e.response.text)
            return ""
