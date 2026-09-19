"""Run the URLShield mini backend on port 8081."""

import uvicorn


if __name__ == "__main__":
    uvicorn.run(
        "mini_backend.api:app",
        host="0.0.0.0",
        port=8081,
        reload=False,
    )
