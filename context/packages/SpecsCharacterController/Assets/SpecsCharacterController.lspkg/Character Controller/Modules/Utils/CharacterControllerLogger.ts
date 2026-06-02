import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { MovementController } from "../MovementController";

/**
 * CharacterControllerLogger handles logging warnings via Utilities Logger.
 * It also can be used to debug Character Controller if text input is added
 * to component and set to CharacterControllerLogger's constructor.
 */
export class CharacterControllerLogger {
    private static readonly TAG = "CharacterController";

    private readonly shouldLogPositions: boolean = true;

    private readonly shouldLogOverlapInfo: boolean = false;

    private readonly shouldLogGroundInfo: boolean = true;

    private readonly shouldLogColliderConstraints: boolean = true;

    private readonly utilitiesLogger: Logger | null;

    constructor(
        private readonly shouldPrintWarnings: boolean,
        private readonly text: Text,
        private readonly movementControllerProvider: () => MovementController
    ) {
        this.utilitiesLogger = shouldPrintWarnings
            ? new Logger(CharacterControllerLogger.TAG, true, true)
            : null;
    }

    printWarning(message: string): void {
        if (this.utilitiesLogger) {
            this.utilitiesLogger.warn(message);
        }
    }

    clear(): void {
        if (this.text) {
            this.text.text = "";
        }
    }

    logGroundInfo(getMessage: () => string): void {
        if (this.text && this.shouldLogGroundInfo) {
            this.text.text += "\n" + getMessage() + "\n\n";
        }
    }

    logPosition(getMessage: () => string): void {
        if (this.text && this.shouldLogPositions) {
            this.text.text += "\n" + getMessage() + " : \n" + this.movementControllerProvider().currentPosition + "\n";
        }
    }

    logOverlapInfo(getMessage: () => string): void {
        if (this.text && this.shouldLogOverlapInfo) {
            this.text.text += "\n" + getMessage();
        }
    }

    logColliderConstraints(getMessage: () => string): void {
        if (this.text && this.shouldLogColliderConstraints) {
            this.text.text += "\n" + getMessage();
        }
    }
}
