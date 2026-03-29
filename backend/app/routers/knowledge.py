from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from typing import List
import logging
from app.database import get_db

logger = logging.getLogger(__name__)
from app.models.document import Document, KnowledgeChunk
from app.models.menu_item import MenuItem
from app.models.restaurant import Restaurant
from app.schemas.knowledge import DocumentResponse, KnowledgeSearchResult
from app.middleware.auth import get_current_owner
from app.models.owner import Owner
from app.services.document_service import extract_text_sync
from app.services.rag_service import chunk_text, store_chunks, keyword_search
from app.services.ai_engine import extract_menu_items

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

ALLOWED_TYPES = {".pdf", ".docx", ".txt"}
MAX_FILE_SIZE = 10 * 1024 * 1024   # 10 MB


@router.post("/upload", response_model=DocumentResponse, status_code=201)
def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form("general"),
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    """Upload a document, extract text, chunk it, and store in knowledge base."""
    # Validate file extension
    filename = file.filename or ""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {ALLOWED_TYPES}")

    # Check for duplicate filename for this owner
    existing = db.query(Document).filter(
        Document.owner_id == current_owner.id,
        Document.filename == filename,
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A document named '{filename}' already exists. Delete it first if you want to replace it.",
        )

    # Read file (sync read via SpooledTemporaryFile)
    content = file.file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")

    try:
        text = extract_text_sync(content, filename)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not extract text: {e}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="Document appears to be empty")

    try:
        restaurant = db.query(Restaurant).filter(Restaurant.owner_id == current_owner.id).first()
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        document = Document(
            owner_id=current_owner.id,
            restaurant_id=restaurant.id,
            filename=filename,
            doc_type=doc_type,
            content=text,
        )
        db.add(document)
        db.flush()

        chunks = chunk_text(text)
        count = store_chunks(
            db=db,
            document_id=document.id,
            owner_id=current_owner.id,
            restaurant_id=restaurant.id,
            chunks=chunks,
            doc_type=doc_type,
        )
        document.chunk_count = count
        db.commit()
        db.refresh(document)

        # Auto-extract menu items when a menu document is uploaded
        menu_items_extracted = None
        if doc_type == "menu":
            try:
                logger.info("Starting menu item extraction for document: %s (text length: %d)", filename, len(text))
                extracted = extract_menu_items(text)
                logger.info("Extracted %d items from menu document", len(extracted))
                inserted = 0
                for item in extracted:
                    name = item.get("name", "").strip()
                    if not name:
                        continue
                    db.add(MenuItem(
                        restaurant_id=restaurant.id,
                        category=item.get("category", "General").strip(),
                        name=name,
                        description=item.get("description") or None,
                        price=float(item.get("price", 0) or 0),
                        available=True,
                    ))
                    inserted += 1
                db.commit()
                menu_items_extracted = inserted
                logger.info("Inserted %d menu items into DB", inserted)
            except Exception as exc:
                logger.error("Menu item extraction failed (document still saved): %s", exc)
                menu_items_extracted = 0

        return {
            "id": document.id,
            "owner_id": document.owner_id,
            "filename": document.filename,
            "doc_type": document.doc_type,
            "chunk_count": document.chunk_count,
            "created_at": document.created_at,
            "menu_items_extracted": menu_items_extracted,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")


@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    return db.query(Document).filter(Document.owner_id == current_owner.id).all()


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    doc = db.query(Document).filter(
        Document.id == doc_id, Document.owner_id == current_owner.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    db.delete(doc)    # Cascades to KnowledgeChunks
    db.commit()
    return {"message": "Document and its chunks deleted"}


@router.post("/sync-menu")
def sync_menu_from_knowledge(
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    """Re-extract menu items from all uploaded menu documents."""
    restaurant = db.query(Restaurant).filter(Restaurant.owner_id == current_owner.id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    menu_docs = db.query(Document).filter(
        Document.owner_id == current_owner.id,
        Document.doc_type == "menu",
    ).all()

    if not menu_docs:
        return {"inserted": 0, "message": "No menu documents found in knowledge base"}

    # Clear existing menu items before re-importing
    db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant.id).delete()
    db.commit()

    total = 0
    for doc in menu_docs:
        if not doc.content or not doc.content.strip():
            continue
        try:
            items = extract_menu_items(doc.content)
            for item in items:
                name = item.get("name", "").strip()
                if not name:
                    continue
                db.add(MenuItem(
                    restaurant_id=restaurant.id,
                    category=item.get("category", "General").strip(),
                    name=name,
                    description=item.get("description") or None,
                    price=float(item.get("price", 0) or 0),
                    available=True,
                ))
                total += 1
            db.commit()
        except Exception as exc:
            logger.error("sync-menu extraction failed for doc %s: %s", doc.filename, exc)

    return {"inserted": total, "message": f"Menu synced: {total} items imported from {len(menu_docs)} document(s)"}


@router.get("/search", response_model=List[KnowledgeSearchResult])
def search_knowledge(
    query: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    """Test endpoint to search the RAG knowledge base."""
    results = keyword_search(db, current_owner.id, query, top_k=10)
    return [
        KnowledgeSearchResult(
            chunk_text=chunk.chunk_text,
            doc_type=chunk.doc_type,
            document_id=chunk.document_id,
            score=round(score, 3),
        )
        for chunk, score in results
    ]
