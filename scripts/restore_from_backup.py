import os
import re

BACKUP_DIR = "/mnt/MyDrive/notebooklm-ingest"
TARGET_DIR = "/home/runner/Meowstik"

# Files we MUST NOT overwrite because they contain our PGlite patches
PROTECTED_FILES = {
    "server/db.ts",
    "server/services/job-queue.ts",
    "server/googleAuth.ts",
    "package.json",
}

def parse_and_restore(filename):
    path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(path):
        print(f"Skipping {filename} (not found)")
        return

    print(f"Processing {filename}...")
    
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    current_file = None
    buffer = []
    
    # Mode: 0=scanning, 1=reading_content
    # But for server.txt, the header is multi-line.
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check for server.txt style header
        # ================================================================================
        # FILE: path/to/file
        # ================================================================================
        if line.strip() == "=" * 80:
            # Could be start or end of header
            if i + 2 < len(lines) and lines[i+1].strip().startswith("FILE: ") and lines[i+2].strip() == "=" * 80:
                # Found a new file header!
                # 1. Save previous file if exists
                if current_file:
                    save_file(current_file, buffer)
                
                # 2. Start new file
                # Extract filename safely
                header_line = lines[i+1].strip()
                if header_line.startswith("FILE: "):
                    current_file = header_line[6:].strip()
                else:
                    # Should not happen given the if check
                    current_file = "unknown_file"
                
                buffer = []
                i += 3 # Skip the 3 header lines
                continue
        
        # Check for meowstik_schema.txt style header
        # --- FILE: path/to/file ---
        if line.startswith("--- FILE: ") and line.strip().endswith(" ---"):
            # Found a new file header!
            # 1. Save previous file if exists
            if current_file:
                save_file(current_file, buffer)
            
            # 2. Start new file
            match = re.match(r"--- FILE: (.+) ---", line.strip())
            if match:
                current_file = match.group(1).strip()
                buffer = []
                i += 1
                continue

        # If we are inside a file, append line
        if current_file:
            buffer.append(line)
        
        i += 1
    
    # Save the last file
    if current_file:
        save_file(current_file, buffer)

def save_file(rel_path, content_lines):
    if rel_path in PROTECTED_FILES:
        print(f"  SKIPPING protected file: {rel_path}")
        return

    full_path = os.path.join(TARGET_DIR, rel_path)
    dir_path = os.path.dirname(full_path)
    
    # Ensure directory exists
    os.makedirs(dir_path, exist_ok=True)
    
    # Write content
    with open(full_path, 'w', encoding='utf-8') as f:
        f.writelines(content_lines)
    
    print(f"  Restored: {rel_path}")

if __name__ == "__main__":
    # Check if target dir exists
    if not os.path.exists(TARGET_DIR):
        print(f"Error: Target directory {TARGET_DIR} does not exist.")
        exit(1)

    print(f"Restoring to {TARGET_DIR}...")
    
    # Priority: schema first, then server/client
    files_to_process = ["meowstik_schema.txt", "server.txt", "client.txt"]
    
    for fname in files_to_process:
        parse_and_restore(fname)
    
    print("Restore complete.")
