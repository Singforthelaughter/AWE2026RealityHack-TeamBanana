import {GridLayout, LayoutDirection} from "SpectaclesUIKit.lspkg/Scripts/Components/GridLayout/GridLayout"
import {ScrollWindow} from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow"
import {getSceneRoots} from "SpectaclesUIKit.lspkg/Scripts/Utility/SceneUtilities"
import {ButterflyCollectionEntry, ButterflyCollectionSlot} from "./ButterflyCollectionSlot"
import {ConservationStatusBar} from "./ConservationStatusBar"
import {SeasonCalendar} from "./SeasonCalendar"

const DEFAULT_DATA = JSON.stringify([
  {
    id: "monarch",
    commonName: "Monarch",
    scientificName: "Danaus plexippus",
    summary: "A large migratory butterfly commonly seen in open fields and gardens.",
    wingspan: "3.5-4 in",
    firstSeen: "2026-05-18",
    timesSeen: "4",
    hostPlant: "Milkweed",
    status: "Watch",
    activeMonths: ["mar", "apr", "may", "jun", "jul", "aug", "sep", "oct"],
    discovered: true,
    isNew: true
  },
  {
    id: "painted-lady",
    commonName: "Painted Lady",
    scientificName: "Vanessa cardui",
    summary: "A widespread butterfly with orange and black patterning and fast fluttering flight.",
    wingspan: "2-2.9 in",
    firstSeen: "2026-04-09",
    timesSeen: "7",
    hostPlant: "Thistle",
    status: "Secure",
    startMonth: "mar",
    endMonth: "jun",
    discovered: true
  },
  {
    id: "cloudless-sulphur",
    commonName: "Cloudless Sulphur",
    scientificName: "Phoebis sennae",
    summary: "Bright yellow butterfly usually found in sunny open habitat.",
    wingspan: "2.2-3.1 in",
    firstSeen: "2026-06-02",
    timesSeen: "2",
    hostPlant: "Cassia",
    status: "Secure",
    activeMonths: ["apr", "may", "jun", "jul", "aug", "sep"],
    discovered: true
  },
  {id: "swallowtail", commonName: "Swallowtail", discovered: false},
  {
    id: "red-admiral",
    commonName: "Red Admiral",
    scientificName: "Vanessa atalanta",
    summary: "Dark wings with red bands, often basking on warm surfaces.",
    wingspan: "1.8-3 in",
    firstSeen: "2026-03-27",
    timesSeen: "5",
    hostPlant: "Nettle",
    status: "Watch",
    activeMonths: ["mar", "apr", "may", "jun", "jul", "aug", "sep"],
    discovered: true,
    isNew: true
  },
  {id: "gray-hairstreak", commonName: "Gray Hairstreak", discovered: false}
])

const GENERATED_PREFIX = "GeneratedButterflySlot_"
const COLUMNS = 3

@component
export class ButterflyCollectionManager extends BaseScriptComponent {
  @input
  @hint("Plain template prefab used as the root for each generated collection slot.")
  slotTemplatePrefab!: ObjectPrefab

  @input
  @allowUndefined
  @hint("Optional prefab shown in discovered slots.")
  butterflyPrefab!: ObjectPrefab

  @input
  @hint("JSON array of butterfly collection entries.")
  collectionDataJson: string = DEFAULT_DATA

  @input("vec2", "{6,6}")
  cellSize: vec2 = new vec2(6, 6)

  @input("vec4", "{0.45,0.45,0.45,0.45}")
  cellPadding: vec4 = new vec4(0.45, 0.45, 0.45, 0.45)

  private gridObject: SceneObject | null = null
  private gridLayout: GridLayout | null = null
  private scrollWindow: ScrollWindow | null = null
  private collectionData: ButterflyCollectionEntry[] = []

  public onAwake(): void {
    this.collectionData = this.parseCollectionData(this.collectionDataJson)
    this.createEvent("OnStartEvent").bind(() => {
      const buildEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
      buildEvent.bind(() => {
        this.buildCollection()
      })
      buildEvent.reset(0)
    })
  }

  public setCollectionData(data: ButterflyCollectionEntry[]): void {
    this.collectionData = data || []
    this.buildCollection()
  }

  public buildCollection(): void {
    this.resolveHierarchy()
    if (!this.gridObject || isNull(this.gridLayout)) {
      print("ButterflyCollectionManager: GridLayout object was not found under Collection.")
      return
    }

    this.clearGeneratedSlots()

    const rows = Math.max(1, Math.ceil(this.collectionData.length / COLUMNS))
    this.gridLayout.columns = COLUMNS
    this.gridLayout.rows = rows
    this.gridLayout.cellSize = this.cellSize
    this.gridLayout.cellPadding = this.cellPadding
    this.gridLayout.layoutBy = LayoutDirection.Row

    for (let i = 0; i < this.collectionData.length; i++) {
      const entry = this.collectionData[i]
      const slotObject = this.createSlotObject(entry)
      slotObject.setParent(this.gridObject)
      slotObject.layer = this.gridObject.layer
      const slot =
        (slotObject.getComponent(ButterflyCollectionSlot.getTypeName()) as ButterflyCollectionSlot) ||
        (slotObject.createComponent(ButterflyCollectionSlot.getTypeName()) as ButterflyCollectionSlot)
      slot.configure(entry, isNull(this.butterflyPrefab) ? null : this.butterflyPrefab, this.openInfoPanel)
    }

    if (!this.gridLayout.isInitialized) {
      this.gridLayout.initialize()
    }
    this.gridLayout.layout()
    this.updateScrollDimensions(rows)
  }

  private createSlotObject(entry: ButterflyCollectionEntry): SceneObject {
    if (!isNull(this.slotTemplatePrefab)) {
      const instance = this.slotTemplatePrefab.instantiate(this.gridObject)
      instance.name = GENERATED_PREFIX + entry.id
      return instance
    }
    const slotObject = global.scene.createSceneObject(GENERATED_PREFIX + entry.id)
    return slotObject
  }

  private clearGeneratedSlots(): void {
    if (!this.gridObject) {
      return
    }
    const children = this.gridObject.children
    for (let i = children.length - 1; i >= 0; i--) {
      if (children[i].name.indexOf(GENERATED_PREFIX) === 0) {
        children[i].destroy()
      }
    }
  }

  private updateScrollDimensions(rows: number): void {
    if (isNull(this.scrollWindow)) {
      return
    }

    const totalCellSize = this.gridLayout?.totalCellSize || this.cellSize
    const contentWidth = Math.max(this.scrollWindow.windowSize.x, COLUMNS * totalCellSize.x)
    const contentHeight = Math.max(this.scrollWindow.windowSize.y, rows * totalCellSize.y)
    this.scrollWindow.vertical = contentHeight > this.scrollWindow.windowSize.y
    this.scrollWindow.horizontal = false
    this.scrollWindow.scrollSnapping = false
    this.scrollWindow.scrollDimensions = new vec2(contentWidth, contentHeight)
    this.scrollWindow.scrollPosition = new vec2(0, contentHeight * -0.5 + this.scrollWindow.windowSize.y * 0.5)
  }

  private resolveHierarchy(): void {
    if (this.gridObject && !isNull(this.gridLayout) && !isNull(this.scrollWindow)) {
      return
    }

    const content = this.findChildByName(this.sceneObject, "Content")
    const scrollObject = content ? this.findChildByName(content, "ScrollWindow") : this.findChildByName(this.sceneObject, "ScrollWindow")
    this.gridObject = scrollObject ? this.findChildByName(scrollObject, "GridLayout") : null
    this.gridLayout = this.gridObject ? (this.gridObject.getComponent(GridLayout.getTypeName()) as GridLayout) : null
    this.scrollWindow = scrollObject ? (scrollObject.getComponent(ScrollWindow.getTypeName()) as ScrollWindow) : null
  }

  private openInfoPanel = (entry: ButterflyCollectionEntry): void => {
    const infoPanel = this.findSceneObjectByName("Butterfly Info Object")
    if (!infoPanel) {
      return
    }

    infoPanel.enabled = true
    const isDiscovered = entry.discovered
    this.setTextByName(infoPanel, "Common Name", isDiscovered ? entry.commonName : "Undiscovered Butterfly")
    this.setTextByName(
      infoPanel,
      "Scientific Name (italics",
      isDiscovered ? entry.scientificName || "Scientific name unavailable" : "Identification pending"
    )
    this.setTextByName(
      infoPanel,
      "Summary",
      isDiscovered ? entry.summary || "No summary available yet." : "Discover this butterfly to unlock its field notes."
    )
    this.setTextByName(infoPanel, "Wingspan", "Wing Span: " + (isDiscovered ? entry.wingspan || "--" : "--"))
    this.setTextByName(infoPanel, "First Seen", "First seen: " + (isDiscovered ? entry.firstSeen || "--" : "--"))
    this.setTextByName(infoPanel, "First Seen 1", "Times seen: " + (isDiscovered ? entry.timesSeen || "--" : "--"))
    this.setTextByName(infoPanel, "Host Plant", "Host Plants: " + (isDiscovered ? entry.hostPlant || "--" : "--"))

    const statusObject = this.findChildByName(infoPanel, "Status Bar")
    if (statusObject) {
      const statusBar = statusObject.getComponent(ConservationStatusBar.getTypeName()) as ConservationStatusBar
      if (!isNull(statusBar)) {
        statusBar.setStatusFromDatabase(isDiscovered ? entry.status || "No Info" : "No Info")
      }
    }

    const seasonObject = this.findChildByName(infoPanel, "Season Calendar")
    if (seasonObject) {
      const seasonCalendar = seasonObject.getComponent(SeasonCalendar.getTypeName()) as SeasonCalendar
      if (!isNull(seasonCalendar)) {
        if (!isDiscovered) {
          seasonCalendar.clearSeason()
        } else if (entry.activeMonths && entry.activeMonths.length > 0) {
          seasonCalendar.setActiveMonths(entry.activeMonths)
        } else if (entry.startMonth && entry.endMonth) {
          seasonCalendar.setActiveMonthRange(entry.startMonth, entry.endMonth)
        } else {
          seasonCalendar.clearSeason()
        }
      }
    }
  }

  private parseCollectionData(json: string): ButterflyCollectionEntry[] {
    if (!json || json.trim() === "") {
      return []
    }
    try {
      const parsed = JSON.parse(json) as ButterflyCollectionEntry[]
      return Array.isArray(parsed) ? parsed : []
    } catch (_error) {
      return []
    }
  }

  private setTextByName(root: SceneObject, objectName: string, value: string): void {
    const target = this.findChildByName(root, objectName)
    if (!target) {
      return
    }
    const text = this.getFirstText(target)
    if (!isNull(text)) {
      text.text = value
    }
  }

  private getFirstText(object: SceneObject): Text | null {
    const text = object.getComponent("Component.Text") as Text
    if (!isNull(text)) {
      return text
    }
    const children = object.children
    for (let i = 0; i < children.length; i++) {
      const childText = this.getFirstText(children[i])
      if (!isNull(childText)) {
        return childText
      }
    }
    return null
  }

  private findSceneObjectByName(name: string): SceneObject | null {
    const roots = getSceneRoots()
    for (let i = 0; i < roots.length; i++) {
      const found = this.findChildByName(roots[i], name)
      if (found) {
        return found
      }
    }
    return null
  }

  private findChildByName(root: SceneObject, name: string): SceneObject | null {
    if (root.name === name) {
      return root
    }
    const children = root.children
    for (let i = 0; i < children.length; i++) {
      const found = this.findChildByName(children[i], name)
      if (found) {
        return found
      }
    }
    return null
  }
}
