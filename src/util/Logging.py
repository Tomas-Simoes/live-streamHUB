import logging
import colorlog

# Create a handler with a color formatter
handler = logging.StreamHandler()
handler.setFormatter(colorlog.ColoredFormatter(
    "%(log_color)s%(levelname)-8s%(reset)s %(white)s%(message)s",
    log_colors={
        'DEBUG': 'cyan',
        'INFO': 'green',
        'WARNING': 'yellow',
        'ERROR': 'red',
        'CRITICAL': 'bold_red',
    }
))

# Configure logger
logger = logging.getLogger('example_logger')
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)
