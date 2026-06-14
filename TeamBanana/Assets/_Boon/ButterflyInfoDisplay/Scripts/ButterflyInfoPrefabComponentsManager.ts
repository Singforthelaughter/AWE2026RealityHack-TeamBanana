@component
export class ButterflyInfoPrefabComponentsManager extends BaseScriptComponent {
  static _onReady: ((comp: ButterflyInfoPrefabComponentsManager) => void) | null = null

  @ui.label("Text SceneObject names (case-insensitive):")
  @ui.label("name, common_name, common_names, probability,")
  @ui.label("description, description_gpt, red_list, danger,")
  @ui.label("danger_description, role, kingdom, phylum,")
  @ui.label("class, order, family, genus, spotter, last_seen, seen_by")
  @input
  textArray!: Text[]

  @ui.label("User's captured / spotter photo")
  @input
  userPhotoImage!: Image

  @ui.label("Species images")
  @input
  dataPhotoImageArray!: Image[]

  onAwake() {
    if (ButterflyInfoPrefabComponentsManager._onReady) {
      ButterflyInfoPrefabComponentsManager._onReady(this)
      ButterflyInfoPrefabComponentsManager._onReady = null
    }
  }
}
