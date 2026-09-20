/**
 * Single seam for "announce this on the caption rail". Late-bound because
 * captionSystem is assigned after environment build.
 */
export function showCaption(app, text) {
  if (app.captionSystem && app.captionSystem.enabled) {
    app.captionSystem.show(text);
  }
}
