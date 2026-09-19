"""Main entry point for running API server and worker"""

import asyncio
import os
import signal
import sys
from typing import Optional

import uvicorn

from URLshield.config import get_settings
from URLshield.logger import get_logger, setup_logging
from URLshield.worker import run_worker

logger = get_logger(__name__)


class Application:
    """Main application orchestrator"""
    
    def __init__(self):
        self.settings = get_settings()
        setup_logging(self.settings.log_level, self.settings.log_format)
        self.worker_task: Optional[asyncio.Task] = None
        self.server_task: Optional[asyncio.Task] = None
        self.shutdown_event = asyncio.Event()
    
    async def start_worker(self):
        """Start background worker"""
        logger.info("starting_worker")
        await run_worker(self.settings)
    
    async def start_server(self):
        """Start API server"""
        logger.info("starting_api_server", port=self.settings.api_port)
        
        config = uvicorn.Config(
            "URLshield.api:app",
            host=self.settings.api_host,
            port=self.settings.api_port,
            log_level=self.settings.log_level.lower(),
            access_log=True
        )
        server = uvicorn.Server(config)
        await server.serve()
    
    async def run_browser_smoke_test(self):
        """Launch a single Playwright browser and navigate to a test page"""
        logger.info("browser_smoke_test_start")

        from playwright.async_api import async_playwright

        try:
            async with async_playwright() as playwright:
                browser = await playwright.chromium.launch(headless=self.settings.headless)
                context = await browser.new_context()
                page = await context.new_page()

                try:
                    await page.goto(
                        "https://example.com",
                        wait_until="domcontentloaded",
                        timeout=self.settings.request_timeout_ms,
                    )
                    title = await page.title()
                    logger.info("browser_smoke_test_success", title=title)
                finally:
                    await context.close()
                    await browser.close()
        except Exception as exc:
            logger.error("browser_smoke_test_failed", error=str(exc))
            raise

    async def run(self, mode: str = "all"):
        """Run application in specified mode"""
        
        # Setup signal handlers (not supported on Windows ProactorEventLoop)
        if os.name != 'nt':
            loop = asyncio.get_event_loop()
            for sig in (signal.SIGTERM, signal.SIGINT):
                loop.add_signal_handler(
                    sig,
                    lambda: asyncio.create_task(self.shutdown())
                )
        
        try:
            if mode == "api":
                # API server only
                await self.start_server()
            elif mode == "worker":
                # Worker only
                await self.start_worker()
            elif mode == "browser":
                # Launch single Playwright browser for smoke testing
                await self.run_browser_smoke_test()
                return
            else:
                # Both API and worker
                self.worker_task = asyncio.create_task(self.start_worker())
                self.server_task = asyncio.create_task(self.start_server())
                
                # Wait for shutdown signal
                await self.shutdown_event.wait()
                
        except KeyboardInterrupt:
            logger.info("keyboard_interrupt")
        finally:
            await self.cleanup()
    
    async def shutdown(self):
        """Graceful shutdown"""
        logger.info("shutting_down")
        self.shutdown_event.set()
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.worker_task:
            self.worker_task.cancel()
            try:
                await self.worker_task
            except asyncio.CancelledError:
                pass
        
        if self.server_task:
            self.server_task.cancel()
            try:
                await self.server_task
            except asyncio.CancelledError:
                pass
        
        logger.info("cleanup_complete")


def main(mode: str = "all"):
    """Main entry point"""
    app = Application()
    
    try:
        asyncio.run(app.run(mode))
    except KeyboardInterrupt:
        pass
    except Exception as e:
        logger.error("application_error", error=str(e))
        sys.exit(1)


if __name__ == "__main__":
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    main(mode)


