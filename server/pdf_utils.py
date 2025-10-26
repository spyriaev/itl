import logging
import fitz  # PyMuPDF
from typing import List, Dict, Any, Optional
import uuid
from io import BytesIO
import httpx

logger = logging.getLogger(__name__)


async def extract_pdf_outline(pdf_url: str) -> List[Dict[str, Any]]:
    """
    Extract outline/TOC structure from PDF using PyMuPDF
    
    Returns:
        List of structure items with format:
        {
            'id': str,
            'title': str,
            'level': int,
            'pageFrom': int,
            'pageTo': Optional[int],
            'parentId': Optional[str],
            'orderIndex': int
        }
    """
    try:
        # Download PDF
        async with httpx.AsyncClient() as client:
            response = await client.get(pdf_url)
            response.raise_for_status()
            pdf_data = BytesIO(response.content)
        
        # Open PDF
        doc = fitz.open(stream=pdf_data, filetype="pdf")
        
        # Get outline/TOC
        outline = doc.get_toc()
        
        if not outline:
            logger.info("No outline found in PDF")
            return []
        
        # Build structure
        structure_items = []
        item_map = {}  # Maps outline item to our structure item
        parent_stack = []  # Stack to track hierarchy
        
        for i, (level, title, page) in enumerate(outline):
            # Generate unique ID
            item_id = str(uuid.uuid4())
            
            # Find parent in stack (last item with level < current level)
            parent_id = None
            for parent in reversed(parent_stack):
                if parent['level'] < level:
                    parent_id = parent['id']
                    break
            
            # Build structure item
            item = {
                'id': item_id,
                'title': title.strip(),
                'level': level,
                'pageFrom': page + 1,  # PyMuPDF uses 0-based indexing
                'pageTo': None,  # Will be set later
                'parentId': parent_id,
                'orderIndex': i
            }
            
            # Calculate pageTo based on next item
            if i < len(outline) - 1:
                next_level, next_title, next_page = outline[i + 1]
                if next_level <= level:
                    # Next item is at same or higher level, so this item ends at next page - 1
                    item['pageTo'] = next_page  # Next page is 0-based, so pageTo is also 0-based
                    # Convert to 1-based at the end
                    if i == len(outline) - 2:
                        # Last item in outline, but there might be more pages in document
                        item['pageTo'] = doc.page_count
                    else:
                        # Not last, so it ends where next item starts
                        item['pageTo'] = next_page + 1  # Convert to 1-based
                else:
                    # Next item is nested, so we need to find the next item at same or higher level
                    # This is more complex, let's use a simpler approach
                    item['pageTo'] = None
            else:
                # Last item in outline, goes to end of document
                item['pageTo'] = doc.page_count
            
            structure_items.append(item)
            item_map[(level, title, page)] = item
            
            # Update parent stack
            # Remove items with higher or equal level from stack
            parent_stack = [p for p in parent_stack if p['level'] < level]
            parent_stack.append({'id': item_id, 'level': level, 'page': page})
        
        # Fix page_to for nested items
        for i, item in enumerate(structure_items):
            if item['pageTo'] is None:
                # Find next item at same or higher level
                for j in range(i + 1, len(structure_items)):
                    next_item = structure_items[j]
                    if next_item['level'] <= item['level']:
                        item['pageTo'] = next_item['pageFrom'] - 1
                        break
                
                # If still None, set to document end
                if item['pageTo'] is None:
                    item['pageTo'] = doc.page_count
        
        doc.close()
        
        logger.info(f"Extracted {len(structure_items)} structure items from PDF")
        return structure_items
        
    except Exception as e:
        logger.error(f"Error extracting PDF outline: {e}")
        return []


def convert_page_number(page_str: str, num_pages: int) -> int:
    """
    Convert page string from outline to page number (1-based)
    
    Handles various formats: 'p. 5', '5', etc.
    """
    try:
        # Try to extract number from string
        page_num = int(page_str)
        return max(1, min(page_num, num_pages))
    except (ValueError, TypeError):
        # If conversion fails, return 1 as fallback
        return 1

