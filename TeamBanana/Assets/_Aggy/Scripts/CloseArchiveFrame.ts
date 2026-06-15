import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {FlyingButterflyManager} from "../../_Boon/ButterflyMovement/Scripts/FlyingButterflyManager"

/**
 * CloseArchiveFrame — close button for the persistent "My Archive" panel.
 *
 * Unlike CloseFrameParent (which DESTROYS its object — correct for the one-shot info card),
 * this DISABLES the panel so the agent can reopen it later via `collectionPanel.enabled = true`.
 * It also clears the spawned flying butterflies so reopening doesn't double them.
 *
 * Attach to the SAME object the agent enables/disables (the Collection panel root, which carries
 * the Frame). Wire `flyingButterflyManager` to the same manager the collection tool spawns into.
 */
@component
export class CloseArchiveFrame extends BaseScriptComponent {
  @input
  @allowUndefined
  @hint("FlyingButterflyManager — its spawned butterflies are cleared on close so reopening the archive doesn't double them.")
  flyingButterflyManager: FlyingButterflyManager | null = null

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      const frame = this.sceneObject.getComponent(Frame.getTypeName()) as Frame
      // Frame builds its _buttonHandler in its own OnStartEvent; force initialize() (idempotent)
      // so closeButton's getter doesn't read an undefined handler.
      frame?.initialize()
      frame?.closeButton?.onTriggerUp.add(() => {
        // Clear the flying butterflies first so a later "show me collection" starts fresh.
        if (this.flyingButterflyManager) {
          this.flyingButterflyManager.clearAllButterflies()
        }
        // Disable (NOT destroy) so the agent can reopen this panel.
        this.sceneObject.enabled = false
      })
    })
  }
}
