import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger"

@component
export class TimeManagerExample extends BaseScriptComponent {
  @input isLoggingEnabled: boolean = true
  private logger = new Logger(TimeManagerExample.name, this.isLoggingEnabled, true)

  onAwake() {
    timeManager.setTimeout(() => {
      this.logger.info("Timeout fired after 1 second")
    }, 1000)
  }
}
