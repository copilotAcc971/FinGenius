"""
Simplified PaddleOCR Engine Wrapper Module
Works with various PaddleOCR versions by using minimal parameters
"""

from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import logging


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OCREngine:
    """
    Simplified OCR engine wrapper that works with different PaddleOCR versions
    """

    def __init__(self, use_gpu: bool = False, lang: str = 'en'):
        """Initialize OCR engine"""
        self.use_gpu = use_gpu
        self.lang = lang
        self.engines = {}
        self._initialized = False

        # Try to import PaddleOCR
        try:
            from paddleocr import PaddleOCR
            self.PaddleOCR = PaddleOCR
            logger.info("PaddleOCR imported successfully")
        except ImportError:
            logger.warning("PaddleOCR not installed. Using mock engine for testing.")
            self.PaddleOCR = None

    def _lazy_init(self):
        """Lazy initialization of OCR engines"""
        if self._initialized or not self.PaddleOCR:
            return

        logger.info("Initializing OCR engines...")

        # Create simplified OCR instances for each document type
        # Using only the most basic parameters that should work with any version
        self.engines = {
            'contract': self._create_basic_ocr(),
            'receipt': self._create_basic_ocr(),
            'handwriting': self._create_basic_ocr(),
            'passport': self._create_basic_ocr(),
            'old_scan': self._create_basic_ocr(),
            'default': self._create_basic_ocr()
        }

        self._initialized = True
        logger.info("OCR engines initialized successfully")

    def _create_basic_ocr(self):
        """Create basic OCR instance with minimal parameters"""
        if not self.PaddleOCR:
            return None

        # Use only the most basic parameters
        # The new version may have different parameter names
        try:
            # Try new API first
            return self.PaddleOCR(
                use_textline_orientation=True,  # New parameter name for angle classification
                lang=self.lang,                 # Language
            )
        except:
            # Fall back to simplest initialization
            return self.PaddleOCR(lang=self.lang)

    def run_ocr(self,
                img: np.ndarray,
                doc_type: str = 'default') -> List[Tuple[List, Tuple[str, float]]]:
        """
        Run OCR with appropriate engine for document type

        Args:
            img: Input image as numpy array
            doc_type: Document type (not used in simplified version)

        Returns:
            List of (bbox, (text, confidence)) tuples
        """
        # Initialize engines if needed
        self._lazy_init()

        # If PaddleOCR not available, return mock results
        if not self.PaddleOCR:
            logger.warning("PaddleOCR not available, returning mock results")
            return self._mock_ocr_result()

        # Use the basic engine for all document types in this simplified version
        engine = self.engines.get('default')

        if engine is None:
            logger.error(f"No engine available")
            return []

        try:
            # Run OCR - try different method names for compatibility
            try:
                # New API uses predict
                result = engine.predict(img)
            except:
                # Old API uses ocr
                result = engine.ocr(img, cls=True)

            # Handle different PaddleOCR output formats
            if result is None:
                return []

            # PaddleOCR returns nested list for batch processing
            if isinstance(result, list) and len(result) > 0:
                if isinstance(result[0], list):
                    # Batch format - take first result
                    return result[0] if result[0] is not None else []
                else:
                    # Single result format
                    return result

            return []

        except Exception as e:
            logger.error(f"OCR error: {e}")
            return []

    def extract_text_only(self,
                         img: np.ndarray,
                         doc_type: str = 'default') -> List[str]:
        """Extract just the text strings"""
        result = self.run_ocr(img, doc_type)

        text_lines = []
        for item in result:
            if item and len(item) >= 2:
                # Extract text from (bbox, (text, confidence)) format
                text = item[1][0] if isinstance(item[1], tuple) else item[1]
                if text:
                    text_lines.append(text)

        return text_lines

    def extract_with_confidence(self,
                               img: np.ndarray,
                               doc_type: str = 'default',
                               min_confidence: float = 0.0) -> List[Dict[str, Any]]:
        """Extract text with metadata"""
        result = self.run_ocr(img, doc_type)

        structured = []
        for item in result:
            if item and len(item) >= 2:
                bbox = item[0]
                text_data = item[1]

                if isinstance(text_data, tuple) and len(text_data) >= 2:
                    text, confidence = text_data[0], text_data[1]
                else:
                    text, confidence = str(text_data), 1.0

                # Filter by confidence
                if confidence >= min_confidence:
                    structured.append({
                        'text': text,
                        'confidence': float(confidence),
                        'bbox': bbox,
                        'position': self._get_bbox_position(bbox)
                    })

        return structured

    def _get_bbox_position(self, bbox: List) -> Dict[str, float]:
        """Calculate position metrics from bounding box"""
        if not bbox or len(bbox) < 4:
            return {}

        # Calculate center and dimensions
        x_coords = [point[0] for point in bbox]
        y_coords = [point[1] for point in bbox]

        return {
            'x_min': min(x_coords),
            'x_max': max(x_coords),
            'y_min': min(y_coords),
            'y_max': max(y_coords),
            'width': max(x_coords) - min(x_coords),
            'height': max(y_coords) - min(y_coords),
            'center_x': sum(x_coords) / len(x_coords),
            'center_y': sum(y_coords) / len(y_coords)
        }

    def _mock_ocr_result(self) -> List[Tuple[List, Tuple[str, float]]]:
        """Return mock OCR results for testing"""
        return [
            ([[100, 100], [200, 100], [200, 130], [100, 130]],
             ("Mock OCR Text Line 1", 0.95)),
            ([[100, 150], [300, 150], [300, 180], [100, 180]],
             ("Mock OCR Text Line 2", 0.92)),
            ([[100, 200], [250, 200], [250, 230], [100, 230]],
             ("Testing without PaddleOCR", 0.88))
        ]

    def get_supported_languages(self) -> List[str]:
        """Get list of supported languages"""
        return ['en', 'ch', 'fr', 'german', 'korean', 'japan', 'ar', 'hi', 'ru', 'es']

    def set_language(self, lang: str):
        """Change OCR language"""
        self.lang = lang
        self._initialized = False
        self.engines = {}


# Testing code
if __name__ == "__main__":
    import cv2
    import sys

    # Initialize OCR engine
    print("Initializing Simplified OCR Engine...")
    engine = OCREngine(use_gpu=False, lang='en')

    # Create a simple test image
    print("Creating test image...")
    img = np.ones((600, 800, 3), dtype=np.uint8) * 255

    # Add text to image
    cv2.putText(img, "Test OCR Document", (100, 100),
               cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 2)
    cv2.putText(img, "Line 1: This is a test", (100, 200),
               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    cv2.putText(img, "Line 2: PaddleOCR Testing", (100, 300),
               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)

    cv2.imwrite("test_ocr_simple.jpg", img)

    # Test OCR
    print("\nTesting OCR...")
    text_lines = engine.extract_text_only(img, 'default')

    print(f"\nExtracted {len(text_lines)} lines:")
    for i, line in enumerate(text_lines, 1):
        print(f"  {i}. {line}")

    print("\nSimplified OCR Engine test complete!")