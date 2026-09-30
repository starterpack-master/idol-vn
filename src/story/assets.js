/**
 * Real asset manifest. Missing/null entries fall back to procedural placeholders / synthesized BGM.
 *
 * pano: 2:1 equirectangular JPG (4096x2048 recommended for mobile) in public/pano/.
 *       The CENTER of the image = yaw 0 (the direction the player faces first); left/right edges = behind (180°).
 * bgm:  loopable mp3/ogg in public/bgm/.
 */
export const assets = {
  pano: {
    classroom_day: null,    // e.g. 'pano/classroom_day.jpg'
    classroom_sunset: null,
    rooftop_day: null,
    rooftop_sunset: null,
    bedroom_night: null,
    karaoke: null,
    hongdae_night: null,
    livehouse: null,
    practice_room: null,
  },
  bgm: {
    title: null,   // e.g. 'bgm/title.mp3'
    daily: null,
    night: null,
    heart: null,
    live: null,
    rival: null,
    tension: null,
  },
};
