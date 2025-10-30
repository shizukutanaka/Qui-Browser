# GitHub Discussions Templates & Guidelines

**Purpose:** Facilitate community discussions with clear templates and best practices
**Status:** Active for v5.7.0+ community engagement

---

## Discussion Categories & Templates

### Category 1: Announcements

**Purpose:** Team announcements about releases, features, and important updates

**Template:**
```markdown
# [Announcement] [Title - e.g., "v5.7.1 Released"]

## Summary
Brief 1-2 sentence summary of the announcement.

## Details
Detailed information about the announcement.

## Links
- [Link to release notes](link)
- [Link to documentation](link)
- [Link to discussion](link)

## Questions?
Reply in this discussion thread!
```

**Guidelines:**
- Use for official releases
- Major feature announcements
- Important updates
- Community milestones
- Not for general questions (use Q&A instead)

---

### Category 2: General Discussion

**Purpose:** Open discussion about the project, ideas, and general chat

**Template:**
```markdown
# [Discussion] [Your Topic Here]

## What's this about?
Explain what you want to discuss.

## Background
Any context that would be helpful?

## Your thoughts?
What's your perspective?

## Related discussions
- [Link to related discussion](link)
```

**Guidelines:**
- Casual, friendly tone
- Open-ended discussions
- Project feedback
- Ideas and suggestions
- No question format needed

---

### Category 3: Show and Tell

**Purpose:** Share projects, creations, and cool things you've built

**Template:**
```markdown
# [Showcase] [Your Project Name]

## What is it?
Brief description of what you built.

## Features
- Feature 1
- Feature 2
- Feature 3

## Demo/Screenshots
[Screenshots, GIFs, or links to live demo]

## Code
[Link to source code if available]

## What I used
- Qui Browser VR v5.7.0
- Feature 1: Gesture recognition
- Feature 2: Spatial anchors

## Try it!
[Link to try the project]

## Questions/Feedback
Open for feedback and questions!
```

**Guidelines:**
- Show off your projects
- Share VR creations
- Post screenshots/videos
- Get feedback from community
- Great way to show appreciation for the project

---

### Category 4: Q&A (Questions)

**Purpose:** Ask technical questions and get help

**Template:**
```markdown
# [Question] [Your Question Here]

## What I'm trying to do
Clear description of what you want to accomplish.

## What I've tried
Steps you've already taken to solve it.

## What's happening
What error/behavior are you seeing?

## What I expected
What should happen instead?

## Environment
- VR Device: Meta Quest 3 / Pico 4 / etc.
- Browser: Chrome / Edge / Firefox
- OS: Windows / macOS / Linux / Android
- Qui Browser VR version: v5.7.0

## Code/Examples
```javascript
// Paste relevant code here
```

## Related issues
[Links to related issues if any]

## Additional context
Any other helpful information?
```

**Guidelines:**
- Be specific and detailed
- Include environment info
- Share code examples
- Search before asking (may already be answered)
- Be patient and respectful
- Community and team will help!

---

### Category 5: Ideas (Feature Requests)

**Purpose:** Suggest new features and improvements

**Template:**
```markdown
# [Idea] [Feature/Improvement Name]

## Problem
What problem does this solve?
Or what's missing?

## Proposed Solution
How would you solve it?

## Alternative Solutions
Other ways to approach this?

## Benefits
Why is this important?
Who would benefit?

## Examples
Real-world use cases?

## Implementation Notes
Any thoughts on how to implement?

## Related discussions
- [Link to related discussions](link)

## Community Thoughts?
Would others find this useful?
```

**Guidelines:**
- Constructive suggestions
- Consider others' perspectives
- Be open to feedback
- Help refine ideas together
- Appreciate all contributions

---

## Best Practices for All Discussions

### Tone & Communication

**Do:**
- ✅ Be respectful and kind
- ✅ Assume good intent
- ✅ Be constructive
- ✅ Help others
- ✅ Share knowledge

**Don't:**
- ❌ Be rude or condescending
- ❌ Spam or advertise
- ❌ Share credentials/secrets
- ❌ Post off-topic content
- ❌ Harass or discriminate

### Formatting

```markdown
# Use headers properly
Use **bold** for emphasis
Use `code blocks` for code snippets
Use > for quotes
Use - for lists
```

### Code Formatting

**Good:**
```javascript
// Using code blocks makes it clear
function example() {
  return "formatted code";
}
```

**Bad:**
```
just pasting code without formatting
function example() { return "messy"; }
```

### Creating Good Discussions

**Title Guidelines:**
- Be specific: "How to enable hand tracking?" ✅
- Avoid vague: "Help with hand tracking?" ❌
- Use category tag: "[Question]", "[Idea]", "[Bug]" ✅
- Keep concise: 5-10 words ideal

**Content Guidelines:**
- First paragraph: Quick summary
- Provide context and background
- Show what you've already tried
- Include error messages/output
- Link to related discussions
- Ask specific questions

---

## Moderation Guidelines

### Discussion Expectations

**Respectful Community:**
- All opinions valued
- Disagreements welcome
- Focus on ideas, not people
- Diverse perspectives appreciated
- Constructive feedback encouraged

### Moderation Actions

**Level 1: Gentle Reminder**
- Off-topic content
- Minor tone issues
- Formatting problems

**Level 2: Warning**
- Repeated minor issues
- Disrespectful tone
- Spam-like behavior

**Level 3: Action**
- Harassment or discrimination
- Severe off-topic content
- Spam/advertising
- Action: Pin moderator response, potentially hide/delete

**Level 4: Removal**
- Persistent violations
- Severe abuse
- Action: Thread locked or user removed

### Reporter Process

If you see a problematic discussion:
1. Report using GitHub's report button
2. Or mention @moderator in a comment
3. Provide context and specifics
4. We'll review within 24 hours

---

## Community Recognition

### Active Participants

We recognize community members who:
- ✅ Answer questions helpfully
- ✅ Contribute ideas
- ✅ Show & tell projects
- ✅ Help others
- ✅ Provide feedback
- ✅ Share knowledge

**Recognition Methods:**
- Mention in monthly updates
- Special badge (if available)
- Featured in newsletter
- Invited to planning discussions
- Potential contributor roles

---

## Discussion Examples

### Example 1: Good Question

```markdown
# [Question] How to recognize custom hand gestures?

## What I'm trying to do
I want to detect a specific hand gesture (peace sign)
and trigger an action when it's recognized.

## What I've tried
- Read the API documentation
- Looked at gesture recognition examples
- Tried recording my own gesture

## What's happening
The gesture isn't being recognized reliably.
Success rate is about 40%.

## What I expected
Gesture should be recognized 90%+ of the time.

## Environment
- VR Device: Meta Quest 3
- Browser: Chromium (Quest Browser)
- OS: Android (Quest)
- Qui Browser VR version: v5.7.0

## Code Example
```javascript
const gestureRecognizer = new VRMLGestureRecognition({
  confidenceThreshold: 0.7
});

// Recording custom gesture
await gestureRecognizer.recordCustomGesture('peace-sign');

// Trying to detect it
gestureRecognizer.on('gesture', (gesture) => {
  if (gesture.type === 'peace-sign') {
    console.log('Peace sign detected!');
  }
});
```

## Questions
1. Is 0.7 confidence threshold too high?
2. Do I need more training samples?
3. Is there a way to improve recognition accuracy?

## Additional context
I've recorded about 50 samples of the peace sign gesture.
The gesture is consistent but sometimes has slight variations.
```

**Why this is good:**
- Clear, specific question
- Shows what's been tried
- Includes relevant code
- Environment information
- Specific sub-questions
- Shows effort and research

---

### Example 2: Good Idea

```markdown
# [Idea] Gesture Profiles for Different Apps

## Problem
Currently, gesture bindings are global across the entire application.
But different apps might want different gesture controls.
For example: games want different gestures than productivity apps.

## Proposed Solution
Add gesture profile system:
- Default profile (current behavior)
- Per-app profiles (game, productivity, creative)
- User-customizable profiles
- Profile switching API

## Benefits
- Better user experience per app type
- Accessibility improvements
- Power users can customize
- Reduces gesture conflicts
- Improves workflow efficiency

## Example Use Case
Game developer wants:
- Gesture A = Jump
- Gesture B = Attack
- Gesture C = Interact

Productivity app wants:
- Gesture A = Open menu
- Gesture B = Undo
- Gesture C = Save

## Implementation Ideas
```javascript
// API could look like:
const profileManager = new VRGestureProfileManager();

// Create profile
profileManager.createProfile('gaming');
profileManager.bindGesture('gaming', 'peace-sign', 'jump');

// Switch profile
profileManager.switchProfile('gaming');

// Query current profile
const currentProfile = profileManager.getCurrentProfile();
```

## Related discussions
- [Gesture Customization Thread](link)
- [Gesture Macro Support](link)

## Community Thoughts?
Would this be useful for your projects?
Any other profile types we should consider?
```

**Why this is good:**
- Clear problem statement
- Specific solution
- Real-world examples
- Code examples showing API
- Considers extensibility
- Asks for community input

---

### Example 3: Good Showcase

```markdown
# [Showcase] VR Physics Playground

## What is it?
A virtual reality physics sandbox where users can create
objects, apply forces, and watch them interact realistically.

## Features
- Real-time physics simulation (Cannon.js)
- Hand gesture controls for object manipulation
- Multiple physics materials (wood, metal, rubber)
- Performance metrics display
- Gesture macro recording for complex interactions

## Demo
[Link to live demo: https://example.com/vr-physics]
[Video: https://youtube.com/example]

## Screenshots
[Screenshots showing:]
- Object creation interface
- Physics interaction examples
- Performance metrics overlay
- Gesture controls visualization

## Code
[GitHub repo: https://github.com/user/vr-physics-playground]

## What I used from Qui Browser VR
- Hand Gesture Recognition (v5.7.0)
- Performance Monitor (optimization)
- Spatial Anchors (for saving scene)
- Advanced Eye Tracking (menu control)

## Try it!
1. Open in Meta Quest Browser
2. Allow hand tracking when prompted
3. Use gestures to interact with objects
4. Record custom gesture macros

## Performance
- Runs at 90 FPS on Quest 3
- ~1.2GB memory usage
- <2s initial load time
- Smooth 60 FPS for physics at 72 FPS refresh

## Technical Details
- Built with Three.js r152
- Cannon.js physics engine
- Gesture recognition ML model
- Optimized for Quest 2+ devices

## Questions & Feedback
Open for suggestions and questions!
Would you like to see specific features?
```

**Why this is good:**
- Clear description
- Shows what was used from Qui Browser
- Live demo link
- Screenshots/videos
- Code available
- Performance metrics
- Easy to try
- Opens discussion

---

## Discussion Best Practices Checklist

**Before posting:**
- [ ] Read pinned discussions
- [ ] Search for similar discussions
- [ ] Choose correct category
- [ ] Use clear title
- [ ] Fill in template sections
- [ ] Format code properly
- [ ] Check for sensitive info (no credentials!)
- [ ] Proofread for clarity

**After posting:**
- [ ] Monitor for responses
- [ ] Reply to comments
- [ ] Provide feedback to helpers
- [ ] Update with solutions found
- [ ] Thank contributors
- [ ] Mark if resolved

---

## Resources

### Helpful Links
- [Qui Browser VR Documentation](link)
- [API Reference](link)
- [Examples](link)
- [Troubleshooting Guide](link)
- [FAQ](link)

### Common Topics
- Hand Gesture Recognition
- Performance Optimization
- Spatial Anchors
- Eye Tracking
- Custom Gestures
- Deployment Issues

### Getting Help
1. **Documentation:** Check docs first
2. **Discussions:** Search for similar questions
3. **Q&A:** Ask specific, detailed question
4. **Issues:** Report bugs
5. **Community:** Experienced developers help!

---

## Conclusion

**These discussion guidelines help create a welcoming, productive community where everyone can learn, share, and grow together.**

- ✅ **Be kind and respectful**
- ✅ **Be helpful and constructive**
- ✅ **Be clear and specific**
- ✅ **Help others succeed**
- ✅ **Share knowledge freely**

**Welcome to the Qui Browser VR community! 🚀**

🤖 *Generated with [Claude Code](https://claude.com/claude-code)*
