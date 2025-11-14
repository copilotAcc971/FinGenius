#!/usr/bin/env python3
"""
Command-line interface for Advanced OCR System
"""

import click
import json
import os
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.core.pipeline import AdvancedOCRPipeline


@click.group()
def cli():
    """Advanced OCR System - 10x better than basic OCR"""
    pass


@cli.command()
@click.argument('image_path', type=click.Path(exists=True))
@click.option('--type', '-t',
              type=click.Choice(['contract', 'receipt', 'passport', 'handwriting', 'old_scan']),
              help='Document type (auto-detect if not specified)')
@click.option('--gpu/--no-gpu', default=False, help='Use GPU acceleration')
@click.option('--lang', default='en', help='Language for OCR')
@click.option('--output', '-o', help='Output directory for results')
@click.option('--debug', is_flag=True, help='Save debug images')
@click.option('--json', 'output_json', is_flag=True, help='Output as JSON')
def process(image_path, type, gpu, lang, output, debug, output_json):
    """Process a single image"""

    # Initialize pipeline
    pipeline = AdvancedOCRPipeline(use_gpu=gpu, lang=lang, debug=debug)

    # Process image
    click.echo(f"Processing {image_path}...")
    result = pipeline.process_image(
        image_path,
        doc_type=type,
        output_dir=output
    )

    if output_json:
        # Output as JSON
        click.echo(result.to_json())
    else:
        # Human-readable output
        click.echo("\n" + "="*60)
        click.echo(click.style("OCR RESULTS", fg='green', bold=True))
        click.echo("="*60)

        click.echo(f"Document Type: {click.style(result.document_type, fg='cyan')}")
        click.echo(f"Confidence: {click.style(f'{result.confidence:.2%}', fg='yellow')}")
        click.echo(f"Processing Time: {result.processing_time:.2f}s")

        click.echo(f"\n{click.style('Extracted Text', fg='blue', bold=True)} ({len(result.cleaned_text)} lines):")
        click.echo("-"*60)

        # Show first 15 lines
        for i, line in enumerate(result.cleaned_text[:15], 1):
            click.echo(f"{i:3}. {line}")

        if len(result.cleaned_text) > 15:
            click.echo(f"... and {len(result.cleaned_text) - 15} more lines")

        # Show structured data if available
        if result.structured_data:
            relevant_data = {k: v for k, v in result.structured_data.items()
                           if k != 'raw_text' and v}
            if relevant_data:
                click.echo(f"\n{click.style('Structured Data', fg='blue', bold=True)}:")
                click.echo("-"*60)
                for key, value in relevant_data.items():
                    click.echo(f"{key}: {value}")

        if output:
            click.echo(f"\n✓ Results saved to: {output}")


@cli.command()
@click.argument('directory', type=click.Path(exists=True))
@click.option('--pattern', default='*.jpg', help='File pattern (e.g., *.jpg, *.png)')
@click.option('--output', '-o', help='Output directory for results')
@click.option('--gpu/--no-gpu', default=False, help='Use GPU acceleration')
def batch(directory, pattern, output, gpu):
    """Process all images in a directory"""

    import glob

    # Find all matching files
    search_pattern = os.path.join(directory, pattern)
    files = glob.glob(search_pattern)

    if not files:
        click.echo(f"No files found matching {search_pattern}")
        return

    click.echo(f"Found {len(files)} files to process")

    # Initialize pipeline
    pipeline = AdvancedOCRPipeline(use_gpu=gpu)

    # Process batch
    results = pipeline.process_batch(files, output_dir=output)

    # Show summary
    successful = sum(1 for r in results if r.confidence > 0)
    failed = len(results) - successful

    click.echo("\n" + "="*60)
    click.echo(click.style("BATCH PROCESSING COMPLETE", fg='green', bold=True))
    click.echo("="*60)
    click.echo(f"Total: {len(results)} images")
    click.echo(f"Successful: {click.style(str(successful), fg='green')}")
    click.echo(f"Failed: {click.style(str(failed), fg='red')}")

    # Show document type breakdown
    type_counts = {}
    for r in results:
        if r.document_type not in type_counts:
            type_counts[r.document_type] = 0
        type_counts[r.document_type] += 1

    click.echo("\nDocument Types Detected:")
    for doc_type, count in type_counts.items():
        click.echo(f"  {doc_type}: {count}")

    if output:
        click.echo(f"\n✓ Results saved to: {output}")


@cli.command()
@click.argument('image_path', type=click.Path(exists=True))
@click.option('--gpu/--no-gpu', default=False, help='Use GPU acceleration')
def benchmark(image_path, gpu):
    """Compare with basic OCR"""

    pipeline = AdvancedOCRPipeline(use_gpu=gpu)

    click.echo("Running benchmark comparison...")
    comparison = pipeline.benchmark_vs_basic(image_path)

    click.echo("\n" + "="*60)
    click.echo(click.style("BENCHMARK RESULTS", fg='yellow', bold=True))
    click.echo("="*60)

    our = comparison['our_pipeline']
    basic = comparison['basic_ocr']
    improvement = comparison['improvement']

    click.echo(f"Document Type: {comparison['document_type']}")
    click.echo("\nOur Advanced Pipeline:")
    click.echo(f"  Lines detected: {click.style(str(our['lines_detected']), fg='green')}")
    click.echo(f"  Processing time: {our['processing_time']:.2f}s")
    click.echo(f"  Confidence: {our['confidence']:.2%}")

    click.echo("\nBasic OCR:")
    click.echo(f"  Lines detected: {basic['lines_detected']}")
    click.echo(f"  Processing time: {basic['processing_time']:.2f}s")

    click.echo("\nImprovement:")
    additional = f"+{improvement['lines']}"
    percentage = f"+{improvement['percentage']:.1f}%"
    click.echo(f"  Additional lines: {click.style(additional, fg='green')}")
    click.echo(f"  Percentage gain: {click.style(percentage, fg='green')}")


@cli.command()
def test():
    """Run test with sample image"""

    import cv2
    import numpy as np

    click.echo("Creating test image...")

    # Create test receipt image
    img = np.ones((1200, 400, 3), dtype=np.uint8) * 240

    # Add receipt-like text
    cv2.putText(img, "SUPERMARKET", (100, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    cv2.putText(img, "Receipt #12345", (120, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (50, 50, 50), 1)
    cv2.putText(img, "-"*30, (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 100, 100), 1)

    items = [
        ("Coffee", "$3.50"),
        ("Milk 2L", "$4.00"),
        ("Bread", "$2.50"),
        ("Apples 1kg", "$5.00"),
        ("Cheese", "$7.50")
    ]

    y_pos = 250
    for item, price in items:
        cv2.putText(img, item, (50, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
        cv2.putText(img, price, (300, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
        y_pos += 40

    cv2.putText(img, "-"*30, (50, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 100, 100), 1)
    y_pos += 50
    cv2.putText(img, "TOTAL:", (50, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.putText(img, "$22.50", (280, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

    # Add some noise
    noise = np.random.randint(0, 30, img.shape, dtype=np.uint8)
    img = cv2.add(img, noise)

    # Save test image
    test_path = "test_receipt.jpg"
    cv2.imwrite(test_path, img)
    click.echo(f"Test image created: {test_path}")

    # Process it
    click.echo("\nProcessing test image...")
    pipeline = AdvancedOCRPipeline(use_gpu=False, debug=True)
    result = pipeline.process_image(test_path, output_dir="test_output")

    click.echo("\n" + "="*60)
    click.echo(click.style("TEST RESULTS", fg='green', bold=True))
    click.echo("="*60)
    click.echo(f"Document Type: {result.document_type}")
    click.echo(f"Lines Extracted: {len(result.cleaned_text)}")
    click.echo(f"Processing Time: {result.processing_time:.2f}s")

    click.echo("\nExtracted Text:")
    for line in result.cleaned_text:
        click.echo(f"  {line}")

    if result.structured_data.get('total'):
        click.echo(f"\n✓ Total extracted: {result.structured_data['total']}")

    click.echo(f"\n✓ Test complete! Check test_output/ for results")


if __name__ == '__main__':
    cli()