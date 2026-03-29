"""
STNH Techtree Update Logger

Structured JSON logging for techtree update sessions.
Creates detailed logs for tracking and debugging update processes.

Author: STNH Techtree Project
"""

import json
import sys
import platform
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List


class UpdateLogger:
    """
    Structured JSON logger for techtree update sessions.

    Usage:
        logger = UpdateLogger()
        logger.start_session()

        logger.start_phase("Validierung")
        logger.log_step("config.py", "success", 120)
        logger.end_phase()

        logger.start_phase("Tech-Generierung")
        logger.log_step("create_tech_json_new.py", "success", 45000,
                        output={"techs_total": 1991})
        logger.end_phase()

        logger.set_statistics(techs_generated=1991, icons_found=1988)
        logger.add_warning("3 icons not found")
        logger.end_session(success=True)
        logger.save_to_file()
    """

    def __init__(self, logs_dir: Optional[Path] = None):
        """Initialize logger with optional custom logs directory."""
        if logs_dir is None:
            logs_dir = Path(__file__).parent / 'logs'
        self.logs_dir = Path(logs_dir)
        self.logs_dir.mkdir(parents=True, exist_ok=True)

        self.session: Dict[str, Any] = {}
        self.environment: Dict[str, Any] = {}
        self.phases: List[Dict[str, Any]] = []
        self.current_phase: Optional[Dict[str, Any]] = None
        self.statistics: Dict[str, Any] = {}
        self.manual_steps: List[str] = []
        self.errors: List[str] = []
        self.warnings: List[str] = []

        self._session_started = False
        self._log_file_path: Optional[Path] = None

    def start_session(self) -> None:
        """Start a new update session."""
        now = datetime.now()

        self.session = {
            "start_time": now.isoformat(),
            "end_time": None,
            "duration_seconds": None,
            "success": None
        }

        self.environment = {
            "python_version": sys.version.split()[0],
            "platform": platform.system(),
            "platform_version": platform.version(),
            "working_directory": str(Path.cwd())
        }

        self.phases = []
        self.current_phase = None
        self.statistics = {}
        self.manual_steps = []
        self.errors = []
        self.warnings = []

        self._session_started = True

        # Generate log file path
        timestamp = now.strftime("%Y-%m-%d_%H-%M-%S")
        self._log_file_path = self.logs_dir / f"update_{timestamp}.json"

    def set_environment(self, **kwargs) -> None:
        """Add custom environment information."""
        self.environment.update(kwargs)

    def start_phase(self, name: str) -> None:
        """Start a new phase in the update process."""
        if not self._session_started:
            raise RuntimeError("Session not started. Call start_session() first.")

        # End previous phase if still open
        if self.current_phase is not None:
            self.end_phase()

        self.current_phase = {
            "name": name,
            "start_time": datetime.now().isoformat(),
            "end_time": None,
            "duration_ms": None,
            "steps": [],
            "success": None
        }

    def log_step(self, script: str, status: str, duration_ms: int,
                 output: Optional[Dict[str, Any]] = None,
                 error_message: Optional[str] = None) -> None:
        """Log a step within the current phase."""
        if self.current_phase is None:
            raise RuntimeError("No phase started. Call start_phase() first.")

        step = {
            "script": script,
            "status": status,
            "duration_ms": duration_ms,
            "timestamp": datetime.now().isoformat()
        }

        if output is not None:
            step["output"] = output

        if error_message is not None:
            step["error_message"] = error_message

        self.current_phase["steps"].append(step)

        # Track errors at session level
        if status == "error" and error_message:
            self.errors.append(f"{script}: {error_message}")

    def end_phase(self, success: Optional[bool] = None) -> None:
        """End the current phase."""
        if self.current_phase is None:
            return

        now = datetime.now()
        start_time = datetime.fromisoformat(self.current_phase["start_time"])

        self.current_phase["end_time"] = now.isoformat()
        self.current_phase["duration_ms"] = int((now - start_time).total_seconds() * 1000)

        # Determine success based on steps if not explicitly set
        if success is None:
            step_statuses = [s["status"] for s in self.current_phase["steps"]]
            success = all(s == "success" for s in step_statuses) if step_statuses else True

        self.current_phase["success"] = success
        self.phases.append(self.current_phase)
        self.current_phase = None

    def set_statistics(self, **kwargs) -> None:
        """Set session statistics."""
        self.statistics.update(kwargs)

    def add_manual_step(self, step: str) -> None:
        """Add a manual step that needs to be performed after the update."""
        self.manual_steps.append(step)

    def add_warning(self, message: str) -> None:
        """Add a warning message."""
        self.warnings.append(message)

    def add_error(self, message: str) -> None:
        """Add an error message."""
        self.errors.append(message)

    def end_session(self, success: Optional[bool] = None) -> None:
        """End the update session."""
        if not self._session_started:
            return

        # End current phase if still open
        if self.current_phase is not None:
            self.end_phase()

        now = datetime.now()
        start_time = datetime.fromisoformat(self.session["start_time"])

        self.session["end_time"] = now.isoformat()
        self.session["duration_seconds"] = round((now - start_time).total_seconds(), 2)

        # Determine overall success
        if success is None:
            phase_successes = [p["success"] for p in self.phases]
            success = all(phase_successes) if phase_successes else True
            success = success and len(self.errors) == 0

        self.session["success"] = success

    def get_log_data(self) -> Dict[str, Any]:
        """Get the complete log data as a dictionary."""
        return {
            "session": self.session,
            "environment": self.environment,
            "phases": self.phases,
            "statistics": self.statistics,
            "manual_steps_required": self.manual_steps,
            "errors": self.errors,
            "warnings": self.warnings
        }

    def save_to_file(self) -> Path:
        """Save the log to a JSON file and return the file path."""
        if self._log_file_path is None:
            raise RuntimeError("Session not started. Call start_session() first.")

        log_data = self.get_log_data()

        with open(self._log_file_path, 'w', encoding='utf-8') as f:
            json.dump(log_data, f, indent=2, ensure_ascii=False)

        return self._log_file_path

    def print_summary(self) -> None:
        """Print a human-readable summary of the session."""
        print("\n" + "=" * 70)
        print("UPDATE SESSION SUMMARY")
        print("=" * 70)

        # Session info
        status = "SUCCESS" if self.session.get("success") else "FAILED"
        duration = self.session.get("duration_seconds", 0)
        print(f"\nStatus: {status}")
        print(f"Duration: {duration:.1f} seconds")

        # Phase summary
        print(f"\nPhases completed: {len(self.phases)}")
        for phase in self.phases:
            phase_status = "OK" if phase["success"] else "FAILED"
            phase_duration = phase.get("duration_ms", 0) / 1000
            print(f"  - {phase['name']}: {phase_status} ({phase_duration:.1f}s)")

        # Statistics
        if self.statistics:
            print("\nStatistics:")
            for key, value in self.statistics.items():
                print(f"  - {key}: {value}")

        # Warnings
        if self.warnings:
            print(f"\nWarnings ({len(self.warnings)}):")
            for warning in self.warnings[:5]:  # Show max 5
                print(f"  - {warning}")
            if len(self.warnings) > 5:
                print(f"  ... and {len(self.warnings) - 5} more")

        # Errors
        if self.errors:
            print(f"\nErrors ({len(self.errors)}):")
            for error in self.errors:
                print(f"  - {error}")

        # Manual steps
        if self.manual_steps:
            print("\nManual steps required:")
            for i, step in enumerate(self.manual_steps, 1):
                print(f"  {i}. {step}")

        # Log file location
        if self._log_file_path:
            print(f"\nLog saved to: {self._log_file_path.name}")

        print("\n" + "=" * 70)


# Convenience function for simple usage
def create_logger(logs_dir: Optional[Path] = None) -> UpdateLogger:
    """Create and return a new UpdateLogger instance."""
    return UpdateLogger(logs_dir)


if __name__ == '__main__':
    # Demo/test the logger
    logger = UpdateLogger()
    logger.start_session()
    logger.set_environment(
        stnh_mod_path="C:\\Users\\marcj\\git01\\New-Horizons-Development",
        techtree_path="C:\\Users\\marcj\\git09\\stnh_techtree_interactive"
    )

    logger.start_phase("Validierung")
    logger.log_step("config.py", "success", 120)
    logger.end_phase()

    logger.start_phase("Tech-Generierung")
    logger.log_step("create_tech_json_new.py", "success", 45000,
                    output={"techs_total": 1991, "techs_physics": 650})
    logger.end_phase()

    logger.set_statistics(
        techs_generated=1991,
        icons_found=1988,
        icons_missing=3,
        icon_coverage_percent=99.85
    )

    logger.add_warning("3 icons not found: tech_ai_update_dummy_tech, tech_transwarp_test")
    logger.add_manual_step("Run icons/converter.bat")
    logger.add_manual_step("Delete DDS files after conversion")

    logger.end_session()

    # Print summary
    logger.print_summary()

    # Save to file
    log_path = logger.save_to_file()
    print(f"\nDemo log saved to: {log_path}")
