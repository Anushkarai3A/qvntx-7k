class WindSightError(Exception):
    """Base exception for expected application failures."""


class InvalidRequestError(WindSightError):
    """The requested analysis parameters are invalid."""


class UpstreamDataError(WindSightError):
    """Elexon data could not be retrieved or validated."""


class IncompleteDataError(UpstreamDataError):
    """The retrieved dataset is too incomplete to support the analysis."""


class DataUnavailableError(WindSightError):
    """No usable data is available for the requested analysis."""
