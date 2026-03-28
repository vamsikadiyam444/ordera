from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class DocumentResponse(BaseModel):
    id: str
    owner_id: str
    filename: str
    doc_type: str
    chunk_count: int
    created_at: datetime
    menu_items_extracted: Optional[int] = None

    class Config:
        from_attributes = True


class KnowledgeSearchResult(BaseModel):
    chunk_text: str
    doc_type: str
    document_id: str
    score: float   # Relevance score (0-1)
