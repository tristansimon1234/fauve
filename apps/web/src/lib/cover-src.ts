/** What stands for a post in a thumbnail; `at`: the frame of a video to show, in seconds. */
export type Cover = { url: string; video: boolean; at?: number };

/** A cover's source: a video on its frame. */
export const coverSrc = (cover: Cover) => (cover.video ? `${cover.url}#t=${cover.at ?? 0.5}` : cover.url);
