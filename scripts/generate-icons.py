#!/usr/bin/env python3
"""
Icon Generator Script for Meowstik Browser Extensions

This script generates icons for the browser extensions using the Pillow library.
It creates icons in multiple sizes (16x16, 32x32, 48x48, 128x128) with a blue
background and white circle design.

Usage:
    python3 scripts/generate-icons.py
    
Requirements:
    pip3 install Pillow
    
The script will generate icons and place them in:
- browser-extension/icons/
- extension/icons/
- extension-src/icons/
- public/icons/
"""

import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("❌ Error: PIL (Pillow) is not installed.")
    print("Please install it with: pip3 install Pillow")
    sys.exit(1)

# Color constants
TAILWIND_BLUE_500 = (59, 130, 246)  # Main background color
WHITE = (255, 255, 255)  # Circle color

def create_icon(size, filename, output_dir):
    """Create an icon with a blue background and white circle."""
    # Create a new image with Tailwind Blue-500 background
    # Using RGBA mode for compatibility with all browsers and potential transparency in future
    img = Image.new('RGBA', (size, size), color=TAILWIND_BLUE_500 + (255,))
    
    draw = ImageDraw.Draw(img)
    
    # Draw a white circle in the middle
    padding = size // 4
    draw.ellipse([padding, padding, size - padding, size - padding], fill=WHITE + (255,))
    
    # Ensure directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Save the icon
    output_path = os.path.join(output_dir, filename)
    img.save(output_path)
    print(f"✓ Generated {output_path}")
    
    return output_path

def main():
    # Get the repository root directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    
    # Chrome Extensions typically need these 4 sizes
    sizes = {
        16: 'icon16.png',
        32: 'icon32.png',
        48: 'icon48.png',
        128: 'icon128.png'
    }
    
    # Directories where icons need to be placed
    icon_dirs = [
        'browser-extension/icons',
        'extension/icons',
        'extension-src/icons',
        'public/icons'
    ]
    
    print("🎨 Generating extension icons...")
    print()
    
    for icon_dir in icon_dirs:
        output_dir = os.path.join(repo_root, icon_dir)
        print(f"📁 {icon_dir}/")
        
        for size, filename in sizes.items():
            create_icon(size, filename, output_dir)
        
        print()
    
    print("✨ Done! All icons generated successfully.")
    print()
    print("Icons generated:")
    for size, filename in sizes.items():
        print(f"  • {filename} ({size}x{size})")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
