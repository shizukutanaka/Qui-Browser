# VR Browser Sound Assets

This directory contains spatial audio sound effects for the VR browser.

## Sound Files

The VR spatial audio system uses the following sound effects:

- `click.mp3` - UI click sound
- `hover.mp3` - UI hover feedback
- `navigate.mp3` - Page navigation sound
- `notification.mp3` - Notification alert
- `error.mp3` - Error notification
- `success.mp3` - Success notification
- `tab-switch.mp3` - Tab switching sound
- `menu-open.mp3` - Menu opening sound
- `menu-close.mp3` - Menu closing sound
- `typing.mp3` - Keyboard typing sound

## Fallback Behavior

If sound files are not present, the VR spatial audio system will automatically:

1. Generate procedural sound effects using Web Audio API
2. Create simple sine wave beeps as fallback sounds
3. Log warnings but continue functioning

## Adding Custom Sounds

To add custom sounds:

1. Place MP3 files in this directory
2. Ensure files match the names above
3. Keep file sizes small (< 50KB recommended)
4. Use mono audio (spatial effects are added programmatically)
5. Sample rate: 44.1kHz or 48kHz
6. Bit rate: 128kbps or lower for VR performance

## License

Sound effects should be royalty-free or properly licensed.
