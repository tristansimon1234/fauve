// A screen recording of a carousel she likes, given as a ref: a few frames cut once in the
// sandbox (about one per slide she swipes), kept beside it for the designer and its critic,
// and removed with it by the retention.

export const RECORDING_FRAMES = 8;

export const refFramePath = (studioId: string, mediaId: string, i: number) => `${studioId}/refs/${mediaId}/${String(i).padStart(2, "0")}.jpg`;

export const refFramePaths = (studioId: string, mediaId: string) => Array.from({ length: RECORDING_FRAMES }, (_, i) => refFramePath(studioId, mediaId, i));
