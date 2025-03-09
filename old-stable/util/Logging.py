import logging
import colorlog

MESSAGE_LEVEL = 25
logging.addLevelName(MESSAGE_LEVEL, 'MESSAGE')

def message(self, message, *args, **kwargs):
    if self.isEnabledFor(MESSAGE_LEVEL):
        self._log(MESSAGE_LEVEL, message, args, **kwargs)

logging.Logger.message = message

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
        'MESSAGE': 'light_yellow'
    }
))

# Configure logger
logger = logging.getLogger('example_logger')
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)


