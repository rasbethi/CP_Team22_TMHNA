from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import json

BASE_PATH = Path(__file__).resolve().parent.parent
WORKFLOW_STATE_PATH = BASE_PATH / "data" / "workflow_states.json"

# Workflow states
STATE_DRAFT = "DRAFT"
STATE_READY = "READY"
STATE_BLOCKED = "BLOCKED"
STATE_SUBMITTED = "SUBMITTED"
STATE_APPROVED = "APPROVED"
STATE_REJECTED = "REJECTED"

VALID_STATES = [STATE_DRAFT, STATE_READY, STATE_BLOCKED, STATE_SUBMITTED, STATE_APPROVED, STATE_REJECTED]

# State transitions (automatic transitions don't require validation)
ALLOWED_TRANSITIONS = {
    STATE_DRAFT: [STATE_READY, STATE_BLOCKED, STATE_SUBMITTED],
    STATE_READY: [STATE_BLOCKED, STATE_SUBMITTED],  # Can become blocked if critical errors appear
    STATE_BLOCKED: [STATE_READY, STATE_DRAFT],  # Can become ready if issues are resolved
    STATE_SUBMITTED: [STATE_APPROVED, STATE_REJECTED],
    STATE_APPROVED: [],  # Terminal state
    STATE_REJECTED: [STATE_DRAFT, STATE_READY],  # Can go back to draft/ready after fixes
}


def load_workflow_states() -> Dict[str, Dict]:
    """Load workflow states from JSON file."""
    if not WORKFLOW_STATE_PATH.exists():
        return {}
    try:
        with open(WORKFLOW_STATE_PATH, 'r') as f:
            return json.load(f)
    except:
        return {}


def save_workflow_states(states: Dict[str, Dict]):
    """Save workflow states to JSON file."""
    WORKFLOW_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(WORKFLOW_STATE_PATH, 'w') as f:
        json.dump(states, f, indent=2)


def get_submission_state(brand: str) -> str:
    """Get current state for a brand submission."""
    states = load_workflow_states()
    brand_key = brand.lower()
    if brand_key in states:
        return states[brand_key].get("state", STATE_DRAFT)
    return STATE_DRAFT


def set_submission_state(brand: str, new_state: str, user: str, reason: Optional[str] = None, auto: bool = False) -> Dict:
    """
    Set submission state with transition validation and logging.
    
    Args:
        brand: Brand name (TMH or Raymond)
        new_state: Target state
        user: User performing the action (or "system" for automatic transitions)
        reason: Optional reason for transition
        auto: If True, skip validation (for automatic system transitions)
    """
    states = load_workflow_states()
    brand_key = brand.lower()
    
    # Get current state
    current_state = states.get(brand_key, {}).get("state", STATE_DRAFT)
    
    # Validate transition (skip for automatic transitions)
    if new_state not in VALID_STATES:
        raise ValueError(f"Invalid state: {new_state}")
    
    if not auto and current_state != new_state:
        allowed = ALLOWED_TRANSITIONS.get(current_state, [])
        if new_state not in allowed:
            raise ValueError(
                f"Cannot transition from {current_state} to {new_state}. "
                f"Allowed transitions: {allowed}"
            )
    
    # Create or update state entry
    if brand_key not in states:
        states[brand_key] = {
            "submission_id": f"{brand_key}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "brand": brand,
            "state": STATE_DRAFT,
            "created_at": datetime.now().isoformat(),
            "transitions": []
        }
    
    # Only log transition if state actually changes
    if current_state != new_state:
        transition = {
            "from_state": current_state,
            "to_state": new_state,
            "user": user,
            "timestamp": datetime.now().isoformat(),
            "reason": reason,
            "auto": auto
        }
        states[brand_key]["transitions"].append(transition)
        states[brand_key]["state"] = new_state
        states[brand_key]["updated_at"] = datetime.now().isoformat()
        
        save_workflow_states(states)
    
    return states[brand_key]


def get_state_transitions(brand: str) -> List[Dict]:
    """Get transition history for a brand."""
    states = load_workflow_states()
    brand_key = brand.lower()
    if brand_key in states:
        return states[brand_key].get("transitions", [])
    return []


def can_edit(brand: str, role: str) -> bool:
    """Check if current role can edit submission for brand."""
    state = get_submission_state(brand)
    
    if state == STATE_DRAFT:
        # Brand controllers can edit their own draft
        if role in ['liam', 'ethan']:
            return True
    elif state == STATE_REJECTED:
        # Brand controllers can edit rejected submissions
        if role in ['liam', 'ethan']:
            return True
    elif state == STATE_APPROVED:
        # No one can edit approved submissions
        return False
    elif state == STATE_SUBMITTED:
        # Enterprise can review, brand cannot edit
        return False
    
    return False


def can_submit(brand: str, role: str) -> bool:
    """Check if current role can submit for brand."""
    state = get_submission_state(brand)
    
    # Can submit from READY, DRAFT, or REJECTED states
    if state in [STATE_READY, STATE_DRAFT, STATE_REJECTED]:
        if role in ['liam', 'ethan']:
            return True
    
    return False


def can_approve(role: str) -> bool:
    """Check if role can approve submissions."""
    return role == 'maya'


def can_reject(role: str) -> bool:
    """Check if role can reject submissions."""
    return role == 'maya'


def get_all_states() -> Dict[str, Dict]:
    """Get all workflow states (for enterprise view)."""
    return load_workflow_states()

