"""Utility functions for URLShield"""

import os
from pathlib import Path


def mkdir_with_permissions(path: Path, mode: int = 0o777):
    """Create directory with explicit permissions to avoid umask issues
    
    This is critical in Docker environments where umask may restrict
    permissions on created directories, causing permission errors.
    
    Args:
        path: Directory path to create
        mode: Permission mode (default: 0o777 for full access)
    """
    # Create directory with parents
    path.mkdir(parents=True, exist_ok=True)
    
    # Set permissions on ALL directories in the path (from root to leaf)
    # This ensures parent directories also get correct permissions
    parts = []
    current = path
    while current != current.parent:
        parts.append(current)
        current = current.parent
    
    # Apply permissions from parent to child
    for dir_path in reversed(parts):
        try:
            os.chmod(dir_path, mode)
        except Exception as e:
            # Only ignore permission errors for directories we don't own
            # Log other errors for debugging
            if not isinstance(e, PermissionError):
                import logging
                logging.warning(f"Failed to chmod {dir_path}: {e}")


