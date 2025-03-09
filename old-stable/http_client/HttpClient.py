import aiohttp
import ssl
import asyncio
from util.Logging import logger 
import warnings
import time
from pathlib import Path

SSL_PATH = Path(__file__).resolve().parent.parent / \
            'data_processor' / 'riotgames.pem'

class HttpClient:
    def __init__(self, options={}):
        self.baseURI = options["baseURI"]
        self.defaultOptions = {
            'headers': {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            'ssl': ssl.create_default_context(cafile=SSL_PATH),
            'timeout': 10
        }

    async def async_get(self, endpoints, options=None):
        if options is None:
            options = [{}]

        if len(endpoints) == 0:
            raise ValueError(
                "Invalid endpoints passed as argument. It cannot be empty")

        async def get(url, option):
            headers, ssl, timeout = [option.get(n)
                                     for n in ['headers', 'ssl', 'timeout']]

            if ssl is None:
                ssl = False
                warnings.warn("Could not get the right SSL certificate. Running without certificate.")
            
            async with session.get(url, headers=headers, ssl=ssl, timeout=timeout) as resp:
                try:
                    return await resp.json()
                except aiohttp.ClientTimeout:
                    logger.error("Request timed out.")
                    return None
                except aiohttp.ClientError as e:
                    logger.error(f"HTTP request failed: {e}")
                    return None

        async with aiohttp.ClientSession() as session:
            tasks = []

            for n in range(len(endpoints)):
                options[n].update(self.defaultOptions)

            for endpoint, option in zip(endpoints, options):
                url = f'{self.baseURI}{endpoint.value}'
                tasks.append(asyncio.ensure_future(get(url, option)))

            return await asyncio.gather(*tasks)
