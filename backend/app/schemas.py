from pydantic import BaseModel, HttpUrl


class GenerateRequest(BaseModel):
    url: HttpUrl