# Spectacles Development Best Practices

## Overview

This document outlines recommended best practices for Spectacles and Lens Studio development. These are guidelines to help maintain clean, organized, and maintainable projects - not strict enforcement rules.

> **Note:** We expect more official documentation on best practices soon. The **SnapCloud** project in the samples directory is an excellent reference implementation of these practices.

---

## Project Organization

### Directory Structure

Keep your contributions organized within a **`Project/`** folder in your Assets directory:

```
Assets/
├── Project/                    # Your main contribution folder
│   ├── Scripts/               # TypeScript/JavaScript source files
│   ├── Materials/             # Custom materials
│   ├── Shaders/               # Custom shader code
│   ├── Textures/              # Texture files
│   ├── Images/                # Image assets
│   ├── Prefabs/               # Reusable scene objects
│   ├── Animations/            # Animation files
│   ├── Sound/                 # Audio files
│   └── Data/                  # JSON configs, data files
├── Render/                    # Rendering-related components
│   ├── CameraTexture/
│   ├── EnvironmentMaps/
│   └── [camera layer configs]
└── Examples/                  # Standout examples (optional)
```

### Special Folder Guidelines

**Render Folder:**
- Keep all render components together (Camera textures, Environment maps, etc.)
- Place anything dealing with camera layers and rendering here
- Keeps rendering concerns separate from game logic

**Examples Folder:**
- If something stands out and should be immediately visible
- Lives at the root of Assets/ for easy discovery
- Used when you want users to find something right away

**Imported Assets:**
- For complex imports (e.g., Sketchfab models with many dependencies)
- Keep them in their own folder with all related files
- Acceptable to have these live independently if they contain animations, textures, and other bundled content

---

## Language-Specific Organization

### Dual Language Projects (TypeScript + JavaScript)

If your codebase exists in both JS and TS:

**Option 1: Separate Folders**
```
Scripts/
├── TS/                        # TypeScript implementations
└── JS/                        # JavaScript implementations
```

**Option 2: File Suffix**
```
Scripts/
├── MyComponent.ts             # TypeScript version
├── MyComponent.js             # JavaScript version
├── Helper.TS.ts               # Explicit TS suffix
└── Helper.JS.js               # Explicit JS suffix
```

> **Example:** Check the **Essentials** project for suffix usage examples.

---

## Package Management

### Packed vs Unpacked Packages

**✅ RECOMMENDED: Keep Packages Packed**
- **Do not unpack packages** unless strictly necessary
- Packed packages remain linked for "Pull Update from Library" functionality
- Maintains cleaner project structure
- Reduces project size and complexity

**⚠️ When You Must Modify a Package Component:**

1. **Duplicate the component** (don't modify the original)
2. **Add a "Modified" suffix** to the filename
   - Example: `Interactable_Modified.ts`
3. **Update imports** at the top of the script to reference new dependencies
4. **Mark the package folder** as "Modified" if you've unpacked it
5. **Keep the modified package in its own folder**

```typescript
// Original package import
import { Interactable } from "SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable"

// Your modified version
import { Interactable_Modified } from "./Interactable_Modified"
```

---

## User Experience Enhancements

### In-Lens Education

**Add Text Guidelines:**
- Include UI text to educate users on how to use your lens
- Explain gestures, interactions, and features
- Make instructions clear and concise

**3D Hand Hints:**
- Use **Spectacles3DHandHints** package for visual gesture guidance
- Show users which hand gestures are required
- Display hints for specific interaction patterns
- Essential for lenses with custom gesture requirements

---

## Code Standards

### Comments and Documentation

**Single-Line Comments:**
```typescript
// Keep comments as one-liners for consistency
// If you need more explanation, use multiple single-line comments
```

**Class Documentation:**
```typescript
/**
 * PlayerController
 *
 * Manages player movement and interaction with the game world.
 * Connected to: GameManager, InputHandler, PhysicsSystem
 *
 * Lifecycle: Initializes in onAwake, starts tracking in onStart
 */
@component
export class PlayerController extends BaseScriptComponent {
    // Class implementation
}
```

### Variable Hints

Add type hints and descriptive names:

```typescript
// ✅ Good - Clear intent and type
private movementSpeed: number = 5.0
private targetPosition: vec3 = vec3.zero()
private isInteracting: boolean = false

// ❌ Bad - Unclear purpose
private speed = 5.0
private pos = vec3.zero()
private flag = false
```

### Lifecycle Methods

**Don't skip lifecycle methods** - always include them even if empty:

```typescript
@component
export class MyComponent extends BaseScriptComponent {
    onAwake() {
        if (this.enableLogs) {
            print("[MyComponent] onAwake called")
        }
        // Initialization logic
    }

    createEvent("OnStartEvent").bind(() => {
        if (this.enableLogs) {
            print("[MyComponent] OnStartEvent triggered")
        }
        // Start logic
    })

    createEvent("UpdateEvent").bind(() => {
        // Update logic (can be empty with log)
    })
}
```

### Error Handling and Logging

**Allow undefined and handle errors gracefully:**

```typescript
@input
private targetObject: SceneObject | undefined

onAwake() {
    if (!this.targetObject) {
        print("[ERROR] MyComponent: targetObject is not assigned!")
        return
    }

    // Proceed with logic
}
```

**Implement logging controls:**

```typescript
@component
export class MyComponent extends BaseScriptComponent {
    @input
    private enableLogs: boolean = true

    @input
    private verboseLogs: boolean = false

    private log(message: string, verbose: boolean = false) {
        if (!this.enableLogs) return
        if (verbose && !this.verboseLogs) return

        print(`[MyComponent] ${message}`)
    }

    onAwake() {
        this.log("Component initialized")
        this.log("Detailed initialization info...", true)  // Verbose log
    }
}
```

### Code Quality

**Avoid `var` keyword:**
```typescript
// ✅ Good
const maxHealth = 100
let currentHealth = 100

// ❌ Avoid
var maxHealth = 100
```

**Use code formatters:**
- Use tools like **Prettier** for consistent formatting
- Maintains even spacing and syntax
- Makes collaboration easier
- Keeps codebase clean and readable

---

## Documentation Files

### README.md

Include in your project README:

```markdown
# Project Name

Brief description of what your lens does.

## Features
- Feature 1
- Feature 2

## How to Use
Step-by-step instructions with screenshots/GIFs.

## Technical Details
- Framework dependencies
- API requirements
- Performance considerations

## Demo
![Demo GIF](./path/to/demo.gif)

## Credits
List any third-party assets or code used.
```

**Add animated GIFs and technical explanations** to make your README engaging and informative.

### .gitignore

Standard Lens Studio `.gitignore`:

```gitignore
# Lens Studio
.temp/
Workspaces/
Cache/
Packages/
*.lsc

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

### .gitattributes

For proper line ending handling:

```gitattributes
* text=auto
*.ts text eol=lf
*.js text eol=lf
*.json text eol=lf
*.md text eol=lf
```

### LICENSE

**Always credit sources:**

```
This project includes assets from:
- [Asset Name] by [Author] - [License Type]
- [Model Name] from Sketchfab by [Creator]
```

---

## Framework and Component Usage

### Use Modern Components

**Prefer new UIKit components:**
- Use SpectaclesUIKit for UI elements
- Leverage SpectaclesInteractionKit (SIK) for interactions
- Utilize framework best practices

**Component Selection:**
```typescript
// ✅ Good - Use framework components
import { PinchButton } from "SpectaclesUIKit/Components/UI/PinchButton/PinchButton"
import { Interactable } from "SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable"

// ⚠️ Only if necessary - custom implementations
import { CustomButton } from "./CustomButton_Modified"
```

---

## Package Standards vs Project Standards

**Important Distinction:**

- **Project standards** (this document) are more critical
  - They directly affect maintainability and collaboration
  - Impact how users navigate and understand your project

- **Package standards** are more flexible
  - Packages typically get packed anyway
  - Structure varies greatly based on package purpose
  - Internal organization is less critical

---

## Personalization

> **It's okay to slightly personalize this structure based on your project needs.**

These are guidelines, not rigid rules. Adapt them to fit your specific use case while maintaining the core principles:
- **Organization** - Keep things logically grouped
- **Clarity** - Make it easy for others to understand
- **Maintainability** - Structure for long-term development
- **Documentation** - Explain your decisions

---

## Quick Reference Checklist

### Starting a New Project

- [ ] Create `Assets/Project/` folder structure
- [ ] Set up `Render/` folder for rendering components
- [ ] Add README.md with project overview
- [ ] Include .gitignore and .gitattributes
- [ ] Set up logging system with on/off toggle

### Writing Components

- [ ] Add class-level documentation comment
- [ ] Include all lifecycle methods (even if empty)
- [ ] Implement logging with enable/disable flag
- [ ] Handle undefined inputs with error messages
- [ ] Use const/let instead of var
- [ ] Add type hints to variables

### Using Packages

- [ ] Keep packages packed unless modification is required
- [ ] If modifying, duplicate and add "_Modified" suffix
- [ ] Update imports in modified components

### Before Publishing

- [ ] Add UI text guidelines for users
- [ ] Include 3D hand hints if using custom gestures
- [ ] Create animated GIF for README
- [ ] Document technical requirements
- [ ] Credit all third-party assets in LICENSE
- [ ] Run code formatter (Prettier)
- [ ] Test all features and interactions

---

## Reference Projects

**Excellent Examples of Best Practices:**
- **SnapCloud** - Latest project demonstrating modern best practices
- **Essentials** - Good example of JS/TS dual implementation
- **AI Playground** - Well-organized complex project
- **Navigation Kit** - Clean package structure

Refer to these projects in the `samples/` directory for practical implementation examples.
