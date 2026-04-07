export class UI {
  constructor(fileManager) {
    this.fileManager = fileManager;
    this._prompt   = document.getElementById('interact-prompt');
    this._portalLbl = document.getElementById('portal-label');
    this._roomLbl  = document.getElementById('room-label');
  }

  setRoom(name) {
    this._roomLbl.textContent = name;
  }

  update(player) {
    const canInteract = player.canInteract;
    const target      = player.interactTarget;

    // Portal label (looking at or near a portal)
    if (canInteract && target?.targetRoom) {
      this._portalLbl.textContent = `→ ${target.label}`;
      this._portalLbl.style.display = 'block';
      this._prompt.style.display = 'none';
    } else if (canInteract && target) {
      // Cabinet or other interactable
      const label = target.isOpen ? '[E]  CLOSE' : '[E]  OPEN';
      this._prompt.textContent = label;
      this._prompt.style.display = 'block';
      this._portalLbl.style.display = 'none';
    } else {
      this._prompt.style.display = 'none';
      this._portalLbl.style.display = 'none';
    }
  }
}
