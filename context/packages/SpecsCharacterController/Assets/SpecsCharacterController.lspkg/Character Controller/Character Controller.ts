import { MovementController } from "./Modules/MovementController";
import { CollisionsController } from "./Modules/Collision/CollisionsController";
import { Utils } from "./Modules/Utils/Utils";
import {
  JoystickInputControl,
  JoystickInputControlConfig,
  JoystickPositionTypeConfig,
} from "./Modules/Input/Joystick/JoystickInputControl";
import { BasicMovementAnimationControllerConfig } from "./Modules/Animation/BasicMovement/BasicMovementAnimationControllerConfig";
import { BasicMovementAnimationController } from "./Modules/Animation/BasicMovement/BasicMovementAnimationController";
import { LockAxisController } from "./Modules/LockAxisController";
import { createProbe } from "./Modules/Collision/CollisionHelpers/ProbeHelper";
import { CharacterControllerSettings } from "./Modules/CharacterControllerSettings";
import { InputsValidator } from "./Modules/InputsValidator";
import { assert } from "SnapDecorators.lspkg/assert";
import {
  bindUpdateEvent,
  bindDestroyEvent,
  bindEnableEvent,
  bindDisableEvent,
} from "SnapDecorators.lspkg/decorators";
import { CharacterControllerLogger } from "./Modules/Utils/CharacterControllerLogger";
import { CallbacksWrapper } from "./Modules/Utils/CallbacksWrapper";
import { TransformUpdater } from "./Modules/TransformUpdater";
import { BitmojiMixamoAnimationIsEnabledChecker } from "./Modules/Utils/BitmojiMixamoAnimationIsEnabledChecker";

/**
 * CharacterController
 * Version 1.0.0
 *
 * The Character Controller Component is a modular, customizable movement system designed to
 * support various gameplay formats, including third-person, first-person, side-scroller, and
 * top-down perspectives. It provides a non-physics-based movement model with optional physics
 * interactions, allowing for smooth, responsive controls without physics body dependencies.
 *
 *
 *
 * API:
 *
 * move(direction: vec3): void - Moves the character in the specified direction. Y value will be ignored. To use this API to set character direction manually, please set Input Control Type to None.
 * stopMovement(): void - Immediately stops character movement.
 * setPosition(position: vec3): void - Teleports the character to a specific world position.
 * getPosition(): vec3 - Returns the current world position of the character.
 * setRotation(rotation: quat): void - Sets the character's facing rotation. Will rotate character only around y axis.
 * getRotation(): quat - Gets the character's current rotation.
 * getDirection(): vec3 - Returns the current movement direction.
 * setSprintEnabled(enabled: boolean): void - If true, enables sprinting speed, disables otherwise.
 * isSprinting(): boolean - Returns true if sprint is currently active.
 * setMoveSpeed(speed: number): void - Sets the character's base movement speed.
 * getMoveSpeed(): number - Returns the current base movement speed.
 * setSprintSpeed(speed: number): void - Sets the character's sprint speed.
 * getSprintSpeed(): number - Returns the current sprint speed.
 * isGrounded(): boolean - Returns true if the character is currently grounded.
 * isMoving(): boolean - Returns true if the character is currently moving.
 * getVelocity(): vec3 - Returns the character's current velocity vector.
 * setAutoFaceMovement(enabled: boolean): void - Enables or disables auto-facing toward movement direction.
 * getAutoFaceMovement(): boolean - Returns whether auto-facing movement is enabled.
 * setAcceleration(value: number): void - Sets the acceleration
 * getAcceleration(): number - Returns the acceleration
 * setDeceleration(value: number): void - Sets the deceleration
 * getDeceleration(): number - Returns the deceleration
 * setShowCollider(value: boolean): void - If true is set character's collider is visible
 * getShowCollider(): boolean - Returns whether character's collider is visible
 * setLockXAxis(enabled: boolean): void - Enables or disables movement along the X axis.
 * getLockXAxis(): boolean - Returns whether movement along the X axis is currently locked.
 * setLockYAxis(enabled: boolean): void - Enables or disables movement along the Y axis.
 * getLockYAxis(): boolean - Returns whether movement along the Y axis is currently locked.
 * setLockZAxis(enabled: boolean): void - Enables or disables movement along the Z axis.
 * getLockZAxis(): boolean - Returns whether movement along the Z axis is currently locked.
 *
 *
 *
 * API Events:
 *
 * onCollisionEnter: event1<CollisionEnterEventArgs, void> - Triggered when character starts colliding with another collider.
 * onCollisionStay(): event1<CollisionEnterEventArgs, void> - Triggered while character remains in collision.
 * onCollisionExit: event1<CollisionEnterEventArgs, void> - Triggered when character exits a collision.
 * onOverlapEnter(): event1<OverlapEnterEventArgs, void> - Triggered when character enters an overlap volume.
 * onOverlapStay(): event1<OverlapEnterEventArgs, void> - Triggered while character remains in overlap volumes.
 * onOverlapExit(): event1<OverlapEnterEventArgs, void> - Triggered when character exits an overlap volume.
 *
 */
@component
export class CharacterController extends BaseScriptComponent {
  @ui.group_start("Movement")
  @input
  @hint("Controls how fast the character moves")
  @widget(new SpinBoxWidget(0))
  private moveSpeed: number = 100;

  @input
  @hint("Controls how fast the character runs")
  @widget(new SpinBoxWidget(0))
  private sprintSpeed: number = 200;

  @input
  @hint("Determines how quickly the character reaches full speed")
  @widget(new SpinBoxWidget(0))
  private acceleration: number = 100;

  @input
  @hint("Defines how quickly the character slows down when input stops")
  @widget(new SpinBoxWidget(0))
  private deceleration: number = 100;

  @input
  @hint("Defines the smallest movement distance before applying updates")
  private minMoveDistance: number = 0.01;

  @input
  @hint("Limits movement on steep inclines to prevent unnatural climbing")
  @widget(new SliderWidget(1, 90))
  private slopeLimit: number = 45;

  @input
  @hint(
    "Determines if the character automatically rotates to match the movement direction"
  )
  private autoFaceMovementDirection: boolean = true;

  @input
  @showIf("autoFaceMovementDirection")
  @hint(
    "Defines how smoothly the character rotates towards movement direction, from 0 to 1."
  )
  @widget(new SliderWidget(0, 1))
  private rotationSmoothing: number = 0.5;

  @ui.group_end
  @ui.separator
  @ui.group_start("Constraints")
  @input
  @hint("Disables movement along the X axis")
  private lockXAxis: boolean = false;

  @input
  @hint("Disables movement along the Y axis")
  private lockYAxis: boolean = false;

  @input
  @hint("Disables movement along the Z axis")
  private lockZAxis: boolean = false;

  @ui.group_end
  @ui.separator
  @ui.group_start("Input Control")
  @input
  private readonly enableTouchBlocking: boolean = true;

  @input("int")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("None", 0),
      new ComboBoxItem("Joystick", 1),
    ])
  )
  private inputControlType: number = 0;

  @input
  @allowUndefined
  @showIf("inputControlType", 1)
  private trackingCamera: Camera;

  @input
  @showIf("inputControlType", 1)
  private readonly joystickConfig: JoystickInputControlConfig;

  @ui.group_end
  @ui.separator
  @ui.group_start("Physics")
  @input
  @hint("Controls how fast the character falls")
  @widget(new SpinBoxWidget(undefined, 0))
  private gravity: number = -980;

  @input
  @hint("Determines how much movement influence the player has mid-air")
  @widget(new SliderWidget(0, 1))
  private airControl: number = 1;

  @input
  @hint("Makes character controller collider visible")
  private showCollider: boolean = false;

  @input
  @hint("Enables a virtual ground plane at Y = 0 for simplified grounding")
  private groundIsZero: boolean = false;

  @input
  @widget(new SpinBoxWidget(0.01))
  private groundCheckDistance: number = 1000;

  @input
  @hint("Maximum step height when climbing a step")
  @widget(new SpinBoxWidget(1e-4))
  private stepHeight: number = 10;

  @input
  @hint("Length of capsule")
  @widget(new SpinBoxWidget(0))
  private colliderHeight: number;

  @input
  @hint("Radius of capsule")
  @widget(new SpinBoxWidget(1e-4))
  private colliderRadius: number;

  @input
  @hint("Offset of capsule")
  private colliderCenter: vec3;

  @ui.group_end
  @ui.separator
  @ui.group_start("Animation")
  @input
  private readonly useAnimation: boolean = true;

  @ui.group_start("Animation Config")
  @showIf("useAnimation")
  @ui.group_start("Idle Animation")
  @input
  @label("Animation Asset")
  @allowUndefined
  private readonly idleAnimationAsset: AnimationAsset;

  @input
  @label("Playback Speed")
  @widget(new SpinBoxWidget(0))
  private readonly idlePlaybackSpeed: number = 1.0;

  @ui.group_end
  @ui.group_start("Move Animation")
  @input
  @label("Min Character Speed")
  @widget(new SpinBoxWidget(0))
  readonly moveMinCharacterSpeed: number = 10;

  @input
  @label("Animation Asset")
  @allowUndefined
  private readonly moveAnimationAsset: AnimationAsset;

  @input
  @label("Playback Speed")
  @hint(
    "Playback speed for the animation when the character speed is at its minimum."
  )
  @widget(new SpinBoxWidget(0))
  private readonly movePlaybackSpeed: number = 1.0;

  @ui.group_end
  @ui.group_start("Sprint Animation")
  @input
  @label("Min Character Speed")
  @widget(new SpinBoxWidget(0))
  readonly sprintMinCharacterSpeed: number = 10;

  @input
  @label("Animation Asset")
  @allowUndefined
  private readonly sprintAnimationAsset: AnimationAsset;

  @input
  @label("Playback Speed")
  @hint(
    "Playback speed for the animation when the character speed is at its minimum."
  )
  @widget(new SpinBoxWidget(0))
  private readonly sprintPlaybackSpeed: number = 1.0;

  @ui.group_end
  @ui.group_end
  @ui.group_end
  @ui.separator
  @input("bool", "true")
  @label("Print Warnings")
  private printWarningStatements: boolean;

  private readonly inputsValidator: InputsValidator;

  private animationController: BasicMovementAnimationController;

  private inputControl: JoystickInputControl;

  private readonly probe: Probe;

  private readonly lockAxisController: LockAxisController;

  private readonly movementController: MovementController;

  private readonly collisionsController: CollisionsController;

  private readonly settings: CharacterControllerSettings;

  private readonly logger: CharacterControllerLogger;

  private readonly callbackWrapper: CallbacksWrapper;

  private readonly transformUpdater: TransformUpdater;

  private renderLayer: LayerSet = null;

  constructor() {
    super();
    this.callbackWrapper = new CallbacksWrapper(this);
    this.logger = new CharacterControllerLogger(
      this.printWarningStatements,
      null,
      () => this.movementController
    );
    this.inputsValidator = new InputsValidator(this.logger);
    this.validateInputs();
    this.settings = {
      moveSpeed: this.moveSpeed,
      sprintSpeed: this.sprintSpeed,
      acceleration: this.acceleration,
      deceleration: this.deceleration,
      minMoveDistance: this.minMoveDistance,
      autoFaceMovementDirection: this.autoFaceMovementDirection,
      rotationSmoothing: this.rotationSmoothing,
      lockXAxis: this.lockXAxis,
      lockYAxis: this.lockYAxis,
      lockZAxis: this.lockZAxis,
      showCollider: this.showCollider,
      groundCheckDistance: this.groundCheckDistance,
      maxGroundAngle: this.slopeLimit,
      stepHeight: this.stepHeight,
      groundIsZero: this.groundIsZero,
      colliderHeight: this.colliderHeight,
      colliderRadius: this.colliderRadius,
      colliderCenter: this.colliderCenter,
      gravity: this.gravity,
      airControl: this.airControl,
      sprintEnabled: false,
    };
    this.probe = createProbe({ static: true });
    this.lockAxisController = new LockAxisController(this.settings);
    this.collisionsController = new CollisionsController(
      this.settings,
      this.getSceneObject(),
      this.lockAxisController,
      this.logger,
      this.callbackWrapper
    );
    this.movementController = new MovementController(
      this.settings,
      this.lockAxisController,
      this.getSceneObject(),
      this.collisionsController.characterCollider,
      this.colliderCenter
    );
    this.collisionsController.setDebugDrawEnabled(this.showCollider);
    this.probe.filter.onlyColliders = [
      this.collisionsController.characterCollider,
    ];
    this.transformUpdater = new TransformUpdater(
      this.getSceneObject(),
      this.movementController,
      this.collisionsController,
      this.logger,
      this.lockAxisController
    );
    this.movementController.setInitialScale(
      this.transformUpdater.getInitialScale()
    );
  }

  protected onAwake() {
    this.updateRenderLayerIfNeeded();
    this.initializeAnimationController();
    this.checkMixamoAnimationIsEnabledForBitmoji3D();
    this.initializeInputControl();

    if (this.enableTouchBlocking) {
      global.touchSystem.touchBlocking = true;
    }
    // Run first update immediately so initial state is applied (decorators bind subsequent frames)
    this.onUpdate();
  }

  //HACK: ADDED THESE
  setTargetSpeedModifier(value: number): void {
    this.movementController.setTargetSpeedModifier(value);
  }

  setInputType(inputType: number): void {
    this.inputControlType = inputType;
    this.initializeInputControl();
  }
  //END HACK

  /**
   * Set direction in which character will move on next update.
   * Call move on each update, otherwise character will stop.
   * @param direction - direction vector, will be normalised, y is skipped
   */
  move(direction: vec3): void {
    this.assertNotDestroyed();
    if (direction) {
      direction = new vec3(direction.x, 0, direction.z);
    }
    this.movementController.move(direction);
  }

  stopMovement(): void {
    this.assertNotDestroyed();
    this.movementController.reset();
    this.animationController && this.animationController.reset();
  }

  setPosition(position: vec3): void {
    this.assertNotDestroyed();
    if (!isNull(position)) {
      this.movementController.setPosition(position);
      this.collisionsController.groundDetection.reset();
    }
  }

  getPosition(): vec3 {
    this.assertNotDestroyed();
    return Utils.copyVec3(this.movementController.currentPosition);
  }

  setRotation(rotation: quat): void {
    this.assertNotDestroyed();
    if (!isNull(rotation)) {
      this.movementController.setRotation(rotation);
    }
  }

  getRotation(): quat {
    this.assertNotDestroyed();
    return this.movementController.getRotation();
  }

  getDirection(): vec3 {
    this.assertNotDestroyed();
    const direction = this.movementController.getNextDirection() || vec3.zero();
    return Utils.copyVec3(direction);
  }

  /**
   * If enabled is true enable sprint movement instead of walking
   * (character walks by default), otherwise disable sprint movement
   * and switch to walking.
   * For sprint sprintSpeed is used; for walking - moveSpeed.
   * @param enabled
   */
  setSprintEnabled(enabled: boolean): void {
    this.assertNotDestroyed();
    this.settings.sprintEnabled = this.inputsValidator.validateBoolean(enabled);
  }

  /**
   * Get flag whether sprint movement instead of walking is enabled.
   */
  isSprinting(): boolean {
    this.assertNotDestroyed();
    return this.settings.sprintEnabled;
  }

  setMoveSpeed(speed: number): void {
    this.assertNotDestroyed();
    this.settings.moveSpeed = this.inputsValidator.validateNonNegativeNumber(
      "Move Speed",
      speed
    );
  }

  getMoveSpeed(): number {
    this.assertNotDestroyed();
    return this.settings.moveSpeed;
  }

  setSprintSpeed(speed: number): void {
    this.assertNotDestroyed();
    this.settings.sprintSpeed = this.inputsValidator.validateNonNegativeNumber(
      "Sprint Speed",
      speed
    );
  }

  getSprintSpeed(): number {
    this.assertNotDestroyed();
    return this.settings.sprintSpeed;
  }

  isGrounded(): boolean {
    this.assertNotDestroyed();
    return !!this.collisionsController.groundDetection.getIsCharacterOnGround();
  }

  isMoving(): boolean {
    this.assertNotDestroyed();
    return this.movementController.isMoving();
  }

  getVelocity(): vec3 {
    this.assertNotDestroyed();
    return this.movementController.getVelocity();
  }

  setAutoFaceMovement(enabled: boolean): void {
    this.assertNotDestroyed();
    this.settings.autoFaceMovementDirection =
      this.inputsValidator.validateBoolean(enabled);
  }

  getAutoFaceMovement(): boolean {
    this.assertNotDestroyed();
    return this.settings.autoFaceMovementDirection;
  }

  setAcceleration(value: number): void {
    this.assertNotDestroyed();
    this.settings.acceleration = this.inputsValidator.validateNonNegativeNumber(
      "Acceleration",
      value
    );
  }

  getAcceleration(): number {
    this.assertNotDestroyed();
    return this.settings.acceleration;
  }

  setDeceleration(value: number): void {
    this.assertNotDestroyed();
    this.settings.deceleration = this.inputsValidator.validateNonNegativeNumber(
      "Deceleration",
      value
    );
  }

  getDeceleration(): number {
    this.assertNotDestroyed();
    return this.settings.deceleration;
  }

  /**
   * Enable or disable collider.
   * @param value
   */
  setShowCollider(value: boolean): void {
    this.assertNotDestroyed();
    this.settings.showCollider = this.inputsValidator.validateBoolean(value);
    this.collisionsController.setDebugDrawEnabled(this.settings.showCollider);
  }

  /**
   * Get flag if collider is shown.
   */
  getShowCollider(): boolean {
    this.assertNotDestroyed();
    return this.settings.showCollider;
  }

  get onCollisionEnter(): event1<CollisionEnterEventArgs, void> {
    this.assertNotDestroyed();
    return this.collisionsController.characterCollider.onCollisionEnter;
  }

  get onCollisionStay(): event1<CollisionEnterEventArgs, void> {
    this.assertNotDestroyed();
    return this.collisionsController.characterCollider.onCollisionStay;
  }

  get onCollisionExit(): event1<CollisionEnterEventArgs, void> {
    this.assertNotDestroyed();
    return this.collisionsController.characterCollider.onCollisionExit;
  }

  get onOverlapEnter(): event1<OverlapEnterEventArgs, void> {
    this.assertNotDestroyed();
    return this.collisionsController.characterCollider.onOverlapEnter;
  }

  get onOverlapStay(): event1<OverlapEnterEventArgs, void> {
    this.assertNotDestroyed();
    return this.collisionsController.characterCollider.onOverlapStay;
  }

  get onOverlapExit(): event1<OverlapEnterEventArgs, void> {
    this.assertNotDestroyed();
    return this.collisionsController.characterCollider.onOverlapExit;
  }

  setLockXAxis(enabled: boolean): void {
    this.assertNotDestroyed();
    this.settings.lockXAxis = this.inputsValidator.validateBoolean(enabled);
  }

  getLockXAxis(): boolean {
    this.assertNotDestroyed();
    return this.settings.lockXAxis;
  }

  setLockYAxis(enabled: boolean): void {
    this.assertNotDestroyed();
    this.settings.lockYAxis = this.inputsValidator.validateBoolean(enabled);
  }

  getLockYAxis(): boolean {
    this.assertNotDestroyed();
    return this.settings.lockYAxis;
  }

  setLockZAxis(enabled: boolean): void {
    this.assertNotDestroyed();
    this.settings.lockZAxis = this.inputsValidator.validateBoolean(enabled);
  }

  getLockZAxis(): boolean {
    this.assertNotDestroyed();
    return this.settings.lockZAxis;
  }

  @bindDestroyEvent
  private onDestroy(): void {
    if (!isNull(this)) {
      if (this.inputControl) {
        this.inputControl.onDestroy();
      }
    }
  }

  @bindEnableEvent
  private onEnable(): void {
    if (this.inputControl) {
      this.inputControl.enable();
    }
    this.collisionsController.groundDetection.reset();
  }

  @bindDisableEvent
  private onDisable(): void {
    if (this.inputControl) {
      this.inputControl.disable();
    }
  }

  private updateRenderLayerIfNeeded(): void {
    if (this.getSceneObject().layer !== this.renderLayer) {
      this.renderLayer = this.getSceneObject().layer;
      Utils.assignRenderLayerRecursively(
        this.getSceneObject(),
        this.renderLayer
      );
    }
  }

  @bindUpdateEvent
  private onUpdate(): void {
    this.logger.clear();
    this.waitForAllUpdatesToBeFinished(() => {
      this.updateRenderLayerIfNeeded();
      if (this.inputControlType === 1) {
        const inputControlDirection = this.getInputControlDirection();
        this.movementController.move(inputControlDirection);
        this.movementController.setTargetSpeedModifier(
          inputControlDirection.length
        );
      }
      this.transformUpdater.update();
    });
  }

  private waitForAllUpdatesToBeFinished(onComplete: () => void): void {
    // Ray casts are performed after simulation update, which occurs after script Update but prior to LateUpdate.
    this.probe.rayCast(
      this.colliderCenter.add(vec3.up()),
      this.colliderCenter,
      this.callbackWrapper.wrap(onComplete)
    );
  }

  private initializeAnimationController() {
    if (this.useAnimation) {
      const animationConfig: BasicMovementAnimationControllerConfig = {
        idleAnimation: {
          animationAsset: this.idleAnimationAsset,
          playbackSpeed: this.idlePlaybackSpeed,
        },
        moveAnimationConfigs: [
          {
            minCharacterSpeed: this.moveMinCharacterSpeed,
            animationAsset: this.moveAnimationAsset,
            playbackSpeed: this.movePlaybackSpeed,
          },
          {
            minCharacterSpeed: this.sprintMinCharacterSpeed,
            animationAsset: this.sprintAnimationAsset,
            playbackSpeed: this.sprintPlaybackSpeed,
          },
        ],
      };
      this.animationController = new BasicMovementAnimationController(
        animationConfig,
        this.getSceneObject()
      );
      this.animationController.bindSpeedProvider(this.movementController);
    }
  }

  private getInputControlDirection(): vec3 {
    return this.inputControl?.getDirection() ?? vec3.zero();
  }

  private initializeInputControl() {
    if (this.inputControlType === 1) {
      this.inputControl = new JoystickInputControl(
        this.joystickConfig,
        this.trackingCamera.getSceneObject()
      );
    }
  }

  private checkMixamoAnimationIsEnabledForBitmoji3D(): void {
    if (this.useAnimation) {
      const checker = new BitmojiMixamoAnimationIsEnabledChecker();
      const updateEvent = this.createEvent("UpdateEvent");
      updateEvent.bind(() => {
        checker.checkIsMixamoEnabled(
          this.getSceneObject(),
          this.logger,
          () => (updateEvent.enabled = false)
        );
      });
    }
  }

  private validateInputs(): void {
    this.moveSpeed = this.inputsValidator.validateNonNegativeNumber(
      "Move Speed",
      this.moveSpeed
    );
    this.sprintSpeed = this.inputsValidator.validateNonNegativeNumber(
      "Sprint Speed",
      this.sprintSpeed
    );
    this.acceleration = this.inputsValidator.validateNonNegativeNumber(
      "Acceleration",
      this.acceleration
    );
    this.deceleration = this.inputsValidator.validateNonNegativeNumber(
      "Deceleration",
      this.deceleration
    );
    this.minMoveDistance = this.inputsValidator.validateNonNegativeNumber(
      "Min Move Distance",
      this.minMoveDistance
    );
    this.autoFaceMovementDirection = this.inputsValidator.validateBoolean(
      this.autoFaceMovementDirection
    );
    this.rotationSmoothing = this.inputsValidator.validateNonNegativeNumber(
      "Rotation Smoothing",
      this.rotationSmoothing
    );
    this.lockXAxis = this.inputsValidator.validateBoolean(this.lockXAxis);
    this.lockYAxis = this.inputsValidator.validateBoolean(this.lockYAxis);
    this.lockZAxis = this.inputsValidator.validateBoolean(this.lockZAxis);
    this.showCollider = this.inputsValidator.validateBoolean(this.showCollider);
    this.groundCheckDistance = this.inputsValidator.validatePositiveNumber(
      "Ground Check Distance",
      this.groundCheckDistance
    );
    this.slopeLimit = this.inputsValidator.validatePositiveNumber(
      "Slope Limit",
      this.slopeLimit
    );
    this.stepHeight = this.inputsValidator.validatePositiveNumber(
      "Step Height",
      this.stepHeight
    );
    this.groundIsZero = this.inputsValidator.validateBoolean(this.groundIsZero);
    this.colliderHeight = this.inputsValidator.validateNonNegativeNumber(
      "Collider Height",
      this.colliderHeight
    );
    this.colliderRadius = this.inputsValidator.validatePositiveNumber(
      "Collider Radius",
      this.colliderRadius
    );
    this.colliderCenter = this.inputsValidator.validateNonNull(
      "Collider Center",
      this.colliderCenter,
      vec3.zero()
    );
    this.gravity = this.inputsValidator.validateNonPositiveNumber(
      "Gravity",
      this.gravity
    );
    this.airControl = this.inputsValidator.validateAirControl(this.airControl);
    if (this.inputControlType === 1) {
      if (!this.trackingCamera) {
        this.logger.printWarning(
          "Set Tracking Camera to input to use joystick"
        );
        this.inputControlType = 0;
      }
      if (!this.joystickConfig) {
        this.logger.printWarning("Joystick config is missing");
        this.inputControlType = 0;
      } else {
        if (
          this.joystickConfig.joystickPositionTypeConfig ===
          JoystickPositionTypeConfig.Custom
        ) {
          if (!this.joystickConfig.joystickParent) {
            this.logger.printWarning(
              "Custom joystick position type requires a parent object. " +
                "Set Joystick Parent to input to use joystick"
            );
            this.inputControlType = 0;
          } else {
            if (
              !this.inputsValidator.validateSceneObjectInScreenHierarchy(
                this.joystickConfig.joystickParent
              )
            ) {
              this.logger.printWarning(
                "Joystick Parent should be in screen hierarchy to use joystick"
              );
              this.inputControlType = 0;
            }
          }
        }
      }
    }
    if (this.useAnimation) {
      this.inputsValidator.validateNonNull(
        "Idle Animation Asset",
        this.idleAnimationAsset
      );
      this.inputsValidator.validateNonNull(
        "Move Animation Asset",
        this.moveAnimationAsset
      );
      this.inputsValidator.validateNonNull(
        "Sprint Animation Asset",
        this.sprintAnimationAsset
      );
    }
  }

  private assertNotDestroyed(): void {
    assert(!isNull(this), "CharacterController was destroyed");
  }
}
