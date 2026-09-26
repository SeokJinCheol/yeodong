from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    session_cookie_secure: bool = False
    photon_url: str = "https://photon.komoot.io"
    valhalla_url: str = "http://localhost:8002"
    database_path: str = "./travel.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
