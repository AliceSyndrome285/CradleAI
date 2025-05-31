# Project Documentation

## Interface Preview

<table style="border-collapse: collapse; width: 100%;">
  <tr>
    <td style="text-align: center; padding: 5px;">
      <img src="https://cradleintro.top/app-screenshot.png" alt="APP Screenshot 1" style="max-width: 150px; border: 1px solid #ddd;">
      <br>
    </td>
    <td style="text-align: center; padding: 5px;">
      <img src="https://cradleintro.top/app-screenshot2.png" alt="APP Screenshot 2" style="max-width: 150px; border: 1px solid #ddd;">
      <br>
    </td>
    <td style="text-align: center; padding: 5px;">
      <img src="https://cradleintro.top/app-screenshot3.png" alt="APP Screenshot 3" style="max-width: 150px; border: 1px solid #ddd;">
      <br>
    </td>
    <td style="text-align: center; padding: 5px;">
      <img src="https://cradleintro.top/app-screenshot4.png" alt="APP Screenshot 4" style="max-width: 150px; border: 1px solid #ddd;">
      <br>
    </td>
    <td style="text-align: center; padding: 5px;">
      <img src="https://cradleintro.top/app-screenshot5.png" alt="APP Screenshot 5" style="max-width: 150px; border: 1px solid #ddd;">
      <br>
    </td>
    <td style="text-align: center; padding: 5px;">
      <img src="https://cradleintro.top/app-screenshot6.png" alt="APP Screenshot 6" style="max-width: 150px; border: 1px solid #ddd;">
      <br>
    </td>
  </tr>
</table>

## Contact and Feedback

*   **QQ Group:** 1017292082 (For Q&A, bug reports, feedback)

## Update Log

### 0518 - 1.0.3 Further Optimization

Continued to fix some issues for 1.0.3, no new features added.

**Memory System**

*   Resolved potential application crashes caused by the memory system.
*   Removed redundant settings button.
*   Added more processing methods for table memory, now including: Rebuild, Repair, Summary, Simplify, Refresh, etc.

**Global Regex**

*   If the regex to clear user input causes a message sending error (under construction).
*   When importing a character card, if the card has a regex script, it will be automatically bound to the character.

**Bug Fixes**

*   Issue where character details World Info could not be saved normally after editing/adding.
*   Issue where the position of system default preset entries could not be modified in Global Presets.
*   Codeblock rendering error.

**Performance Optimization**

*   Index page performance optimization.

**UI Optimization**

*   Character World Info editing now uses a full-screen editor window instead of a narrow modal.

**Group Chat**

*   Fixed the issue where group chats could not be disbanded.

### 1.0.4

         ✔ Added `Tool Settings` page to customize prompts for summaries, automatic messages, and image generation.

         ✔ Summaries can now be generated and managed by clicking the `Globe` button in the top right corner.

         ✔ Section Summary: Customize the message range and word count for summaries.

         ✔ Added three channels: cosyvoice, minimax, and Doubao (cosyvoice and minimax use Replicate and require self-prepared accounts). minimax and cosyvoice support voice cloning. cosyvoice allows direct selection of pre-set voice profiles from the character voice interface.(PS cosyvoice and minimax generally have the best voice replication effects, but Replicate's cosyvoice is very slow and expensive, costing about 8 cents per sentence --- please choose carefully based on your financial situation).

         ✔ Decoupled table memory and vector memory. Table memory can now be used independently.

         ✔ Rewrote context to improve performance. Deletion and editing no longer cause errors.

         ✔ Added `Tool Settings` page to customize prompts for summaries, automatic messages, and image generation.

         ✔ Added a Preset/World Book test page to test the message array being sent.

         ✔ Debounced the message list.

         ✔ Fixed the issue where the archive function was invalid.

         ✔ Fixed the issue where sending messages after importing `Remove User Input` type regular expressions caused errors.

         ✔ Added a function to create a new blank branch.

         ✔ Supported the display of NovelAI illustrations in three modes.

         ✔ Resolved the issue where character card backgrounds and avatars were lost after deleting the cache.

         ✔ Customized NAI endpoint.

         ✔ Customized OpenAI compatible endpoint (no longer requires the v1/chat/completions suffix).

         ✔ Automatic NovelAI illustration generation function (now includes an automatic background generation function).

         ✔ Customized interface UI and markdown colors.

         ✔ Resolved the issue of being unable to send images.

         ✔ Resolved the issue of errors when importing Tavern JSON character cards.


## Key Features

### 1. Character Management

*   Supports manual, automatic creation, and importing of SillyTavern character cards, World Info, and presets (PNG/JSON format).
*   Characters can have custom avatars, backgrounds, and animated live portraits.
*   Batch delete and export character data in management mode, supports character gallery and image generation.

### 2. Smart Chat

*   Independently implemented World Info, Presets, and character information systems equivalent to SillyTavern's functions:
    *   **World Info Entry Management**: Automatically inject relevant world setting entries into the conversation, intelligently matched based on conversation keywords.
    *   **Preset Entry Processing**: Customize the position, depth, and character-specific preset entries.
    *   **Character Information Integration**: Seamlessly integrate character cards, World Info, and presets.
*   Memory Management System:
    *   Automatic summarization of long conversations.
    *   Intelligent memory retrieval.
    *   Integrated web search.
*   Supports a checkpoint system, allowing restoration to any historical conversation state at any time.
*   Advanced Interaction Features:
    *   **Author's Notes**: Supports custom author's notes and insertion depth settings.
    *   **Voice Interaction**: Allows characters to speak via TTS function with voice enhancement effects.
    *   **Multimedia Messages**: Send and receive images in conversations, supporting image analysis and contextual understanding.
    *   **Image Management**: Built-in image caching system for easy saving and management of all conversation images.
    *   **Visual Novel Mode**: Provides an immersive conversation interface similar to a visual novel.
*   Advanced Message Formatting:
    *   Rich Text Support: Handles common HTML tags and special tags, developers can customize rendered tags.
    *   Custom Tags: Supports special formats like thought tags, status blocks, memory tags:
        *   `<thinking>` / `<think>` / `<char-think>`: Thought process collapsible block
        *   `<mem>`: Memory collapsible block
        *   `<status>` / `<StatusBlock>` / `<statusblock>` / `<detail>` / `<summery>`: Status bar block
        *   `<websearch>`: Search results collapsible block
        *   `<font>`: Font tag supporting color/face/size attributes
        *   `<img>`: Image tag (supports image:id and regular URLs)
    *   Image Embedding: Supports inline image display and full-screen viewing.
*   Visual Aid Features:
    *   Full conversation history view.
    *   Automatic scrolling and manual position saving.

### 3. Circle

*   Characters and users can post updates and images, supporting likes, comments, and shares.
*   Circle interactions support AI automatic generation of character comments, likes, and display of inner thoughts.
*   Supports user-defined post publishing and image selection.
*   Multimodal Support:
    *   Image Analysis: AI can understand and respond to post content with images.
    *   Intelligent Replies: Generates relevant comments and feedback based on image content.
*   Scheduled Publishing System:
    *   Characters can set multiple times for automatic Circle posts.
    *   Generates appropriate content for the post based on the current time.
    *   Users can be notified after publishing.
*   Relationship System Integration:
    *   Character interactions dynamically affect relationships between characters.
    *   Post comments and likes can improve character affection levels.
    *   Supports updating character relationship types through Circle interactions (e.g., friend, acquaintance, rival, etc.).
*   Conversation Flow Connection:
    *   Circle interactions are automatically synchronized with the character's chat history.
    *   User interactions in the Circle can seamlessly continue into private conversations.
*   Interaction Frequency Control:
    *   Customize character Circle activity level (low, medium, high).
    *   Intelligently manage character interaction frequency to avoid excessive replies.
*   All Circle content can be persistently stored, supporting post management and deletion.

### 4. Group Chat System

*   Supports creating/joining group chats to converse with multiple characters/users.
*   Group chats support custom backgrounds, member management, and message synchronization.

### 5. Memory and Knowledge Management

*   Integrates a vector memory system to automatically store and retrieve conversation-related facts.
*   Supports table plugin to extend character knowledge.
*   Memory panel allows viewing and managing character memory content.
*   Dual System Memory Enhancement:
    *   **Structured Table Memory**: Create custom tables based on templates to store structured information like character relationships, preferences, and events.
    *   **Vector Storage Memory**: Automatically extract key points from conversations and store them as vector memories for later retrieval during conversations.
*   Table Memory Management Features:
    *   Multiple preset templates: Dedicated templates for character relationships, event logs, preference lists, etc.
    *   Custom Editing: Add, delete, and modify table row and column data.
    *   Deep Integration with Conversations: Conversation information automatically updates relevant tables.
*   Vector Memory Management Features:
    *   Retrieval Optimization: Intelligently match the most relevant historical memories to the current conversation.
    *   Memory Editing: Add, modify, and delete specific memory entries.
    *   Memory Export/Import: Supports backing up and restoring character memory data.
*   Memory Priority Control: Customize memory processing frequency to adjust the rate of memory updates and retrieval during conversations.
*   Performance Monitoring: Memory database statistics and health status monitoring.

### 6. TTS Enhancement

*   Supports Text-to-Speech (TTS) functionality to enhance voice interaction experience.
*   TTS enhancer allows customizing voice parameters.
*   Current version requires developers to configure the TTS endpoint (future updates will support frontend self-configuration of TTS endpoints).
*   Supports various voice control features:
    *   Voice playback/pause control.
    *   Enhanced mode for improved audio quality.
    *   Different voice templates for multiple characters.
    *   Automatic caching of generated audio to reduce redundant requests.

### 7. Image Generation and Management

*   Supports NovelAI image generation, automatically generating character scene backgrounds based on conversation context.
*   Character gallery sidebar allows managing, favoriting, and setting images as avatars/backgrounds.
*   Advanced Tag System:
    *   Supports an intelligent tag selector with hundreds of categorized tags.
    *   Supports tag weighting and deweighting.
    *   Fixed tag function to lock important feature tags.
    *   Character tags are selected from the preset library to ensure accurate character identification.
    *   Artist style reference, allows selecting different artist styles.
    *   Custom prompt input, supports complex descriptions.
    *   "Roll" function can randomly generate tag combinations for inspiration.
*   Multi-model Support:
    *   Animagine 4: Default image generation engine (requires developer to configure the endpoint).
    *   NovelAI: Supports more precise control and multi-character scenes.
*   Advanced Generation Settings:
    *   Multiple image size presets: Portrait, Landscape, Square, Large.
    *   Customizable steps, sampler, noise schedule, and other professional parameters.
    *   Supports Seed value management to reproduce images with the same configuration.
*   Multi-character Scene Control (NovelAI):
    *   Position control system for precise positioning of multiple characters in the image.
    *   Supports setting independent prompts for each character in the scene.
    *   Control over multi-character interaction poses and expressions.
*   Generation Result Processing:
    *   One-click setting as character avatar or background image.
    *   Automatic saving to the character gallery.
    *   View and copy generation parameters for easy reuse of the same configuration.

### 8. Other Features

*   Supports API settings, model budget, storage management, community entrance, and other extended functions.
*   Supports multiple themes and UI customization.

## Deployment Method

This application is developed based on the [Expo](https://expo.dev/) framework, and it is recommended to use EAS Build for packaging and deployment:

1.  **Android Platform Packaging**
    Execute the following command in the project root directory to build an Android installation package (APK or AAB) via EAS:
    ```bash
    eas build --platform android
    ```
    After the build is complete, you can download the generated installation package from the Expo dashboard for distribution or installation.

2.  **iOS Platform Packaging**
    You can also generate an IPA package for the iOS platform using the following command:
    ```bash
    eas build --platform ios
    ```
    However, it has not been fully tested on real Apple devices yet, so it is recommended to use with caution in production environments.

> **Note**: Please ensure that your Expo account, EAS CLI, and relevant platform certificates are configured correctly. Refer to the [Expo Official Documentation](https://docs.expo.dev/build/introduction/) for detailed configuration and distribution procedures.

## Current Limitations

### API Support

*   Currently, only Gemini and OpenRouter API channels are supported.
*   Plans to add support for more official API channels in future versions, such as ChatGPT, Claude, etc.
*   Image generation currently only supports NovelAI, plans to add more options.

### Other Known Issues

*   Some advanced features require developers to configure the endpoint themselves.
*   The memory vector database might have performance bottlenecks with a large amount of data.
*   Some features might respond slowly when the network is unstable.

## License

This project is open-sourced under the [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) license and must comply with the following rules:

*   **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
*   **NonCommercial** — You may not use the material for commercial purposes, including but not limited to any form of commercial resale, SaaS, paid API interfaces, resale, packaging and sale, paid distribution, or other direct or indirect profit-making activities.

## Disclaimer

*   This project is a non-commercial open-source frontend tool. Anyone can upload the code to the EXPO platform for packaging and installation, or perform native apk building.
*   There will be no character card upload or sharing function or platform now or in the future. If the character card author has stated that the character card cannot be imported into software outside of SillyTavern, please do not import the character card into the project.
*   Any form of commercial resale, SaaS, paid API interfaces, resale, packaging and sale, paid distribution, or other direct or indirect profit-making activities are prohibited.
*   It is prohibited to package and upload this project to any app store.

## Cited Projects

1.  Table Memory: `https://github.com/muyoou/st-memory-enhancement`. Thanks to the author for sharing the code. Please support the original author.
2.  mem0: `https://github.com/mem0ai/mem0` licensed under the [Apache-2.0 license](https://www.apache.org/licenses/LICENSE-2.0).
3.  OpenAI-adapter: Thanks to author hajimi for providing the testing channel. Project address: `https://github.com/wyeeeee/hajimi`.

## Sponsorship

If you like this project and want to support the author, you can buy me a coffee:

[Buy the author a coffee](https://cradleintro.top/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250430201333.png)
