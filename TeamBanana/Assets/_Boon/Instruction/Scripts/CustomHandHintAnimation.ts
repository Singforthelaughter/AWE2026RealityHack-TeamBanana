import Easing from "LSTween.lspkg/TweenJS/Easing";
import { LSTween } from "Spectacles3DHandHints.lspkg/LSTween/LSTween";
import Tween from "Spectacles3DHandHints.lspkg/LSTween/TweenJS/Tween";
import { mainGroup } from "Spectacles3DHandHints.lspkg/LSTween/TweenJS/mainGroup";

const ANIMATION_END_EVENT_NAME = "AnimationEnd";

@typedef
export class HintAnimation {
  @input("int")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Left", 0),
      new ComboBoxItem("Right", 1),
      new ComboBoxItem("Both", 2),
    ])
  )
  handType: number = 0;

  @input("string")
  @showIf("handType", 0)
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Pinch Near", "pinch_near"),
      new ComboBoxItem("Pinch Far", "pinch_far"),
      new ComboBoxItem("Pinch Move X", "pinch_move_x"),
      new ComboBoxItem("Pinch Move Y", "pinch_move_y"),
      new ComboBoxItem("Pinch Move Z", "pinch_move_z"),
      new ComboBoxItem("Pinch Rotate X", "pinch_rotate_x"),
      new ComboBoxItem("Pinch Rotate Y", "pinch_rotate_y"),
      new ComboBoxItem("Pinch Rotate Z", "pinch_rotate_z"),
      new ComboBoxItem("Pinch Swipe X", "pinch_swipe_x"),
      new ComboBoxItem("Pinch Swipe Y", "pinch_swipe_y"),
      new ComboBoxItem("Finger Tap Near", "finger_tap_near"),
      new ComboBoxItem("Finger Tap Surface", "finger_tap_surface"),
      new ComboBoxItem("Finger Swipe X", "finger_swipe_x"),
      new ComboBoxItem("Finger Swipe Y", "finger_swipe_y"),
      new ComboBoxItem("Finger Scroll Micro", "finger_scroll_micro"),
      new ComboBoxItem("Palm Touch Near", "palm_touch_near"),
      new ComboBoxItem("Palm Touch Surface", "palm_touch_surface"),
      new ComboBoxItem("Palm Swipe X", "palm_swipe_x"),
      new ComboBoxItem("Palm Grab X", "palm_grab_x"),
      new ComboBoxItem("Palm Grab Y", "palm_grab_y"),
    ])
  )
  oneHandedAnimation_l: string = "pinch_near";

  @input("string")
  @showIf("handType", 1)
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Pinch Near", "pinch_near"),
      new ComboBoxItem("Pinch Far", "pinch_far"),
      new ComboBoxItem("Pinch Move X", "pinch_move_x"),
      new ComboBoxItem("Pinch Move Y", "pinch_move_y"),
      new ComboBoxItem("Pinch Move Z", "pinch_move_z"),
      new ComboBoxItem("Pinch Rotate X", "pinch_rotate_x"),
      new ComboBoxItem("Pinch Rotate Y", "pinch_rotate_y"),
      new ComboBoxItem("Pinch Rotate Z", "pinch_rotate_z"),
      new ComboBoxItem("Pinch Swipe X", "pinch_swipe_x"),
      new ComboBoxItem("Pinch Swipe Y", "pinch_swipe_y"),
      new ComboBoxItem("Finger Tap Near", "finger_tap_near"),
      new ComboBoxItem("Finger Tap Surface", "finger_tap_surface"),
      new ComboBoxItem("Finger Swipe X", "finger_swipe_x"),
      new ComboBoxItem("Finger Swipe Y", "finger_swipe_y"),
      new ComboBoxItem("Finger Scroll Micro", "finger_scroll_micro"),
      new ComboBoxItem("Palm Touch Near", "palm_touch_near"),
      new ComboBoxItem("Palm Touch Surface", "palm_touch_surface"),
      new ComboBoxItem("Palm Swipe X", "palm_swipe_x"),
      new ComboBoxItem("Palm Grab X", "palm_grab_x"),
      new ComboBoxItem("Palm Grab Y", "palm_grab_y"),
    ])
  )
  oneHandedAnimation_r: string = "pinch_near";

  @input("string")
  @showIf("handType", 2)
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("System Tap Settings", "system_tap_settings"),
      new ComboBoxItem("System Tap Rotate Down", "system_tap_rotate_down"),
      new ComboBoxItem("System Tap Rotate Up", "system_tap_rotate_up"),
      new ComboBoxItem("System Tap Watch", "system_tap_watch"),
      new ComboBoxItem("System Tap Exit", "system_tap_exit"),
      new ComboBoxItem("Two Hands Pinch Scale", "two_hands_pinch_scale"),
      new ComboBoxItem("Two Hands Pinch Rotate Y", "two_hands_pinch_rotate_y"),
      new ComboBoxItem("Two Hands Pinch Rotate Z", "two_hands_pinch_rotate_z"),
      new ComboBoxItem("Two Hands Palm Grab X", "two_hands_palm_grab_x"),
      new ComboBoxItem("Two Hands Palm Grab Y", "two_hands_palm_grab_y"),
    ])
  )
  twoHandedAnimation: string = "two_hands_pinch_scale";

  @input("vec3")
  position: vec3 = vec3.zero();
}

@component
export class CustomHandHintAnimation extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Playback Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Animation speed, looping, and autoplay settings</span>')

  @input
  autoPlay: boolean = false;

  @input("float")
  @widget(new SliderWidget(0.5, 3, 0.1))
  animationSpeed: number = 1;

  @input("int")
  @widget(new SliderWidget(1, 10, 1))
  numberOfLoops: number = 1;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Animation Sequence</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Hint animations to play in sequence</span>')

  @input
  hintAnimations!: HintAnimation[];

  private handHints!: SceneObject;
  private leftHandMesh!: SceneObject;
  private rightHandMesh!: SceneObject;
  private handJointRootRef!: SceneObject;
  private leftIndexTip!: SceneObject;
  private leftThumbTip!: SceneObject;
  private rightIndexTip!: SceneObject;
  private rightThumbTip!: SceneObject;

  private animationPlayer!: AnimationPlayer;
  private clipsToPlay: HandAnimationClipInfo[] = [];
  private currentAnimationName: string = "";
  private loopsPlayed: number = 0;
  private currentClipInSequenceIndex: number = 0;
  private currentHandMode: number = 0;

  private left_outlineMaterial!: Material;
  private right_outlineMaterial!: Material;
  private left_tipsGlowMaterial!: Material;
  private right_tipsGlowMaterial!: Material;
  private left_outlineFadeTween!: Tween;
  private right_outlineFadeTween!: Tween;
  private current_tween!: Tween;

  private isLeftHandPinching: boolean = false;
  private isRightHandPinching: boolean = false;

  public animationEndEvent!: DelayedCallbackEvent;
  public animationPlayerClipEndEvent!: EventRegistration;

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
    this.animationEndEvent = this.createEvent("DelayedCallbackEvent");

    this.handHints = this.findSceneObjectByName(this.sceneObject, "HandHints");

    this.leftHandMesh = this.findSceneObjectByName(this.handHints, "LeftHandGeo");
    this.rightHandMesh = this.findSceneObjectByName(this.handHints, "RightHandGeo");
    this.handJointRootRef = this.findSceneObjectByName(this.handHints, "hands_ROOT");

    this.leftIndexTip = this.handJointRootRef.getChild(1).getChild(1).getChild(0).getChild(0).getChild(0).getChild(0);
    this.leftThumbTip = this.handJointRootRef.getChild(1).getChild(0).getChild(0).getChild(0).getChild(0).getChild(0);
    this.rightIndexTip = this.handJointRootRef.getChild(0).getChild(1).getChild(0).getChild(0).getChild(0).getChild(0);
    this.rightThumbTip = this.handJointRootRef.getChild(0).getChild(0).getChild(0).getChild(0).getChild(0).getChild(0);

    this.animationPlayer = this.handHints.getComponent("AnimationPlayer");

    this.initHandMeshMaterials();

    if (this.hintAnimations.length > 0) {
      this.hintAnimations.forEach((sequenceItem) => {
        switch (sequenceItem.handType) {
          case 0: {
            this.rightHandMesh.enabled = false;
            this.clipsToPlay.push(new HandAnimationClipInfo(sequenceItem.handType, sequenceItem.oneHandedAnimation_l, sequenceItem.position));
            break;
          }
          case 1: {
            this.leftHandMesh.enabled = false;
            this.clipsToPlay.push(new HandAnimationClipInfo(sequenceItem.handType, sequenceItem.oneHandedAnimation_r, sequenceItem.position));
            break;
          }
          case 2: {
            this.clipsToPlay.push(new HandAnimationClipInfo(sequenceItem.handType, sequenceItem.twoHandedAnimation, sequenceItem.position));
            break;
          }
        }
      });
    }

    if (this.autoPlay && this.clipsToPlay.length > 0) {
      this.playClip();
    }
  }

  private onUpdate() {
    if (
      this.currentAnimationName == "pinch_near" ||
      this.currentAnimationName == "pinch_far" ||
      this.currentAnimationName == "pinch_move_x" ||
      this.currentAnimationName == "pinch_move_y" ||
      this.currentAnimationName == "pinch_move_z" ||
      this.currentAnimationName == "pinch_rotate_x" ||
      this.currentAnimationName == "pinch_rotate_y" ||
      this.currentAnimationName == "pinch_rotate_z" ||
      this.currentAnimationName == "pinch_swipe_x" ||
      this.currentAnimationName == "pinch_swipe_y"
    ) {
      if (this.currentHandMode === 0) {
        this.isLeftHandPinching = this.handleHandPinch(this.leftIndexTip, this.leftThumbTip, this.left_tipsGlowMaterial, this.isLeftHandPinching);
      } else if (this.currentHandMode === 1) {
        this.isRightHandPinching = this.handleHandPinch(this.rightIndexTip, this.rightThumbTip, this.right_tipsGlowMaterial, this.isRightHandPinching);
      }
    }

    if (
      this.currentAnimationName == "two_hands_pinch_scale" ||
      this.currentAnimationName == "two_hands_pinch_rotate_y" ||
      this.currentAnimationName == "two_hands_pinch_rotate_z"
    ) {
      const left_distance = this.leftIndexTip.getTransform().getWorldPosition().distance(this.leftThumbTip.getTransform().getWorldPosition());
      if (left_distance < 2 && !this.isLeftHandPinching) {
        this.left_tipsGlowMaterial.mainPass.glowIntensity = 1.0;
        this.isLeftHandPinching = true;
      } else if (left_distance > 3 && this.isLeftHandPinching) {
        this.left_tipsGlowMaterial.mainPass.glowIntensity = 0.0;
        this.isLeftHandPinching = false;
      }
      const right_distance = this.rightIndexTip.getTransform().getWorldPosition().distance(this.rightThumbTip.getTransform().getWorldPosition());
      if (right_distance < 2 && !this.isRightHandPinching) {
        this.right_tipsGlowMaterial.mainPass.glowIntensity = 1.0;
        this.isRightHandPinching = true;
      } else if (right_distance > 3 && this.isRightHandPinching) {
        this.right_tipsGlowMaterial.mainPass.glowIntensity = 0.0;
        this.isRightHandPinching = false;
      }
    }
  }

  private initHandMeshMaterials(): void {
    const leftRMV = this.leftHandMesh.getComponent("RenderMeshVisual");
    this.left_outlineMaterial = leftRMV.getMaterial(0).clone();
    this.left_tipsGlowMaterial = leftRMV.getMaterial(1).clone();
    const left_occluder = leftRMV.getMaterial(2).clone();
    leftRMV.clearMaterials();
    leftRMV.addMaterial(this.left_outlineMaterial);
    leftRMV.addMaterial(this.left_tipsGlowMaterial);
    leftRMV.addMaterial(left_occluder);
    this.left_outlineMaterial.mainPass.fadeLevel = 0.0;
    this.left_tipsGlowMaterial.mainPass.glowIntensity = 0.0;

    const rightRMV = this.rightHandMesh.getComponent("RenderMeshVisual");
    this.right_outlineMaterial = rightRMV.getMaterial(0).clone();
    this.right_tipsGlowMaterial = rightRMV.getMaterial(1).clone();
    const right_occluder = rightRMV.getMaterial(2).clone();
    rightRMV.clearMaterials();
    rightRMV.addMaterial(this.right_outlineMaterial);
    rightRMV.addMaterial(this.right_tipsGlowMaterial);
    rightRMV.addMaterial(right_occluder);
    this.right_outlineMaterial.mainPass.fadeLevel = 0.0;
    this.right_tipsGlowMaterial.mainPass.glowIntensity = 0.0;
  }

  private playClip() {
    if (this.currentClipInSequenceIndex >= this.clipsToPlay.length) return;

    const clipInfo = this.clipsToPlay[this.currentClipInSequenceIndex];
    this.currentHandMode = clipInfo.handMode;
    this.currentAnimationName = clipInfo.clipName;

    this.fadeInHand(clipInfo);
    this.animationPlayer.setClipEnabled(clipInfo.clipName, true);
    this.animationPlayer.getClip(clipInfo.clipName).playbackSpeed = this.animationSpeed;
    this.getSceneObject().getTransform().setLocalPosition(clipInfo.position);
    this.animationPlayer.playClipAt(clipInfo.clipName, 0);

    const animationAsset = this.animationPlayer.getClip(clipInfo.clipName).animation;
    animationAsset.createEvent(ANIMATION_END_EVENT_NAME, animationAsset.duration);
    this.animationPlayerClipEndEvent = this.animationPlayer.onEvent.add(this.onAnimationEnd.bind(this));
  }

  private onAnimationEnd = (eventData: AnimationPlayerOnEventArgs) => {
    if (eventData.eventName !== ANIMATION_END_EVENT_NAME) return;

    if (this.clipsToPlay.length == 1) {
      this.loopsPlayed += 1;
      if (this.loopsPlayed < this.numberOfLoops) {
        const clipInfo = this.clipsToPlay[this.currentClipInSequenceIndex];
        this.getSceneObject().getTransform().setLocalPosition(clipInfo.position);
        this.animationPlayer.playClipAt(this.currentAnimationName, 0);
      }
    }

    if (this.clipsToPlay.length > 1) {
      this.fadeOutHand().onComplete(() => {
        this.animationPlayer.setClipEnabled(this.currentAnimationName, false);
        this.animationPlayer.onEvent.remove(this.animationPlayerClipEndEvent);

        if (this.loopsPlayed < this.numberOfLoops) {
          this.currentClipInSequenceIndex += 1;
          const clipInfo = this.clipsToPlay[this.currentClipInSequenceIndex];
          this.currentHandMode = clipInfo.handMode;
          this.currentAnimationName = clipInfo.clipName;

          const animationAsset = this.animationPlayer.getClip(clipInfo.clipName).animation;
          animationAsset.createEvent(ANIMATION_END_EVENT_NAME, animationAsset.duration);
          this.animationPlayerClipEndEvent = this.animationPlayer.onEvent.add(this.onAnimationEnd.bind(this));

          this.fadeInHand(clipInfo);
          this.animationPlayer.setClipEnabled(clipInfo.clipName, true);
          this.animationPlayer.getClip(clipInfo.clipName).playbackSpeed = this.animationSpeed;
          this.getSceneObject().getTransform().setLocalPosition(clipInfo.position);
          this.animationPlayer.playClipAt(clipInfo.clipName, 0);

          if (this.currentClipInSequenceIndex == this.clipsToPlay.length - 1) {
            this.loopsPlayed += 1;
            this.currentClipInSequenceIndex -= this.clipsToPlay.length;
          }
        }
      });
    }

    if (this.loopsPlayed == this.numberOfLoops) {
      this.fadeOutHand().onComplete(() => {
        if (!isNull(this.animationEndEvent)) {
          this.animationEndEvent.reset(0);
        }
        this.animationPlayer.setClipEnabled(this.currentAnimationName, false);
        this.animationPlayer.onEvent.remove(this.animationPlayerClipEndEvent);
        this.animationEndEvent = null;
        this.loopsPlayed = 0;
      });
    }
  };

  private safeCancelTween(tween: Tween | null): void {
    if (!isNull(tween)) {
      tween.stop();
      mainGroup.remove(tween);
    }
  }

  private handleHandPinch(indexTip: SceneObject, thumbTip: SceneObject, glowMaterial: Material, isPinching: boolean): boolean {
    const distance = indexTip.getTransform().getWorldPosition().distance(thumbTip.getTransform().getWorldPosition());
    if (distance < 2 && !isPinching) {
      glowMaterial.mainPass.glowIntensity = 1.0;
      isPinching = true;
    } else if (distance > 3 && isPinching) {
      glowMaterial.mainPass.glowIntensity = 0.0;
      isPinching = false;
    }
    return isPinching;
  }

  private fadeInHand(clipInfo: HandAnimationClipInfo) {
    switch (clipInfo.handMode) {
      case 0:
        this.safeCancelTween(this.left_outlineFadeTween);
        this.left_outlineFadeTween = LSTween.shaderFloatPropertyFromTo(this.left_outlineMaterial.mainPass, "fadeLevel", 0.0, 1.0, 200.0);
        this.left_outlineFadeTween.easing(Easing.Cubic.In).start();
        this.left_outlineFadeTween.onStart(() => {
          this.leftHandMesh.enabled = true;
          this.rightHandMesh.enabled = false;
        });
        break;
      case 1:
        this.safeCancelTween(this.right_outlineFadeTween);
        this.right_outlineFadeTween = LSTween.shaderFloatPropertyFromTo(this.right_outlineMaterial.mainPass, "fadeLevel", 0.0, 1.0, 200.0);
        this.right_outlineFadeTween.easing(Easing.Cubic.In).start();
        this.right_outlineFadeTween.onStart(() => {
          this.leftHandMesh.enabled = false;
          this.rightHandMesh.enabled = true;
        });
        break;
      case 2:
        this.safeCancelTween(this.left_outlineFadeTween);
        this.left_outlineFadeTween = LSTween.shaderFloatPropertyFromTo(this.left_outlineMaterial.mainPass, "fadeLevel", 0.0, 1.0, 200.0);
        this.left_outlineFadeTween.easing(Easing.Cubic.In).start();
        this.left_outlineFadeTween.onStart(() => { this.leftHandMesh.enabled = true; });
        this.safeCancelTween(this.right_outlineFadeTween);
        this.right_outlineFadeTween = LSTween.shaderFloatPropertyFromTo(this.right_outlineMaterial.mainPass, "fadeLevel", 0.0, 1.0, 200.0);
        this.right_outlineFadeTween.easing(Easing.Cubic.In).start();
        this.right_outlineFadeTween.onStart(() => { this.rightHandMesh.enabled = true; });
        break;
    }
  }

  private fadeOutHand(): Tween {
    switch (this.currentHandMode) {
      case 0:
        this.safeCancelTween(this.left_outlineFadeTween);
        this.left_outlineFadeTween = LSTween.shaderFloatPropertyFromTo(this.left_outlineMaterial.mainPass, "fadeLevel", 1.0, 0.0, 200.0);
        this.left_outlineFadeTween.easing(Easing.Cubic.In).start();
        this.left_outlineFadeTween.onComplete(() => { this.leftHandMesh.enabled = false; });
        this.safeCancelTween(this.current_tween);
        this.current_tween = LSTween.rawTween(200.0);
        this.current_tween.start();
        return this.current_tween;
      case 1:
        this.safeCancelTween(this.right_outlineFadeTween);
        this.right_outlineFadeTween = LSTween.shaderFloatPropertyFromTo(this.right_outlineMaterial.mainPass, "fadeLevel", 1.0, 0.0, 200.0);
        this.right_outlineFadeTween.easing(Easing.Cubic.In).start();
        this.right_outlineFadeTween.onComplete(() => { this.rightHandMesh.enabled = false; });
        this.safeCancelTween(this.current_tween);
        this.current_tween = LSTween.rawTween(200.0);
        this.current_tween.start();
        return this.current_tween;
      case 2:
        this.safeCancelTween(this.left_outlineFadeTween);
        this.left_outlineFadeTween = LSTween.shaderFloatPropertyFromTo(this.left_outlineMaterial.mainPass, "fadeLevel", 1.0, 0.0, 200.0);
        this.left_outlineFadeTween.easing(Easing.Cubic.In).start();
        this.left_outlineFadeTween.onComplete(() => { this.leftHandMesh.enabled = false; });
        this.safeCancelTween(this.right_outlineFadeTween);
        this.right_outlineFadeTween = LSTween.shaderFloatPropertyFromTo(this.right_outlineMaterial.mainPass, "fadeLevel", 1.0, 0.0, 200.0);
        this.right_outlineFadeTween.easing(Easing.Cubic.In).start();
        this.right_outlineFadeTween.onComplete(() => { this.rightHandMesh.enabled = false; });
        this.safeCancelTween(this.current_tween);
        this.current_tween = LSTween.rawTween(200.0);
        this.current_tween.start();
        return this.current_tween;
    }
  }

  public play(): void {
    this.loopsPlayed = 0;
    this.currentClipInSequenceIndex = 0;
    if (this.clipsToPlay.length > 0) {
      this.playClip();
    }
  }

  private findSceneObjectByName(root: SceneObject | null, name: string): SceneObject | null {
    if (root === null) {
      const count = global.scene.getRootObjectsCount();
      for (let i = 0; i < count; i++) {
        const result = this.findSceneObjectByName(global.scene.getRootObject(i), name);
        if (result) return result;
      }
    } else {
      if (root.name === name) return root;
      for (let i = 0; i < root.getChildrenCount(); i++) {
        const result = this.findSceneObjectByName(root.getChild(i), name);
        if (result) return result;
      }
    }
    return null;
  }
}

export class HandAnimationClipInfo {
  constructor(
    public handMode: HandMode,
    public clipName: string,
    public position: vec3 = vec3.zero()
  ) {}
}

export enum HandMode {
  Left = 0,
  Right = 1,
  Both = 2,
}
