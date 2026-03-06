import { Stitch } from "../types/stitch";

export const stitches: Record<string, Stitch> = {
  magicRing: {
    name: "Magic Ring",
    instructions:
      "Create a loop. Yarn Over loop. Pull through the loop. Yarn over hook to begin chain stitch. Pull through the loop to complete chain stitch.",
    abbreviation: "MR",
    video: "https://www.youtube.com/shorts/kLQfdaTWfvc",
  },
  chain: {
    name: "Chain",
    instructions:
      "Create a slip knot on your hook, yarn over (wrap yarn from back to front), and pull the hook through the loop to form the first chain stitch. Repeat this 'yarn over and pull through' motion to create a foundation chain, keeping tension even",
    abbreviation: "ch",
    video: "https://www.youtube.com/shorts/kLQfdaTWfvc",
  },
  slst: {
    name: "Slip Stitch",
    instructions:
      "To slip stitch in crochet, insert your hook into the next stitch, yarn over, and draw the yarn through the stitch and immediately through the loop on your hook.",
    abbreviation: "sl st",
    video: "https://www.youtube.com/watch?v=8ir3v31G0sg",
  },
  beginning: {
    name: "beginning",
    instructions: "",
    abbreviation: "beg",
    video: "",
  },
  hdc: {
    name: "half double crochet",
    instructions:
      "Yarn over, insert hook into the stitch, yarn over, pull up a loop (3 loops on hook), yarn over, and pull through all 3 loops.",
    abbreviation: "hdc",
    video: "https://www.youtube.com/watch?v=f9C1C21MNiM",
  },
  sts: {
    name: "stitch",
    instructions: "",
    abbreviation: "st",
    video: "",
  },
  rem: {
    name: "stitch",
    instructions: "",
    abbreviation: "remaining",
    video: "",
  },
  rep: {
    name: "repeat",
    instructions: "",
    abbreviation: "rep",
    video: "",
  },
  hdc2tog: {
    name: "half double crochet two stitches together",
    instructions:
      "Yarn over, insert hook into the next stitch, yarn over, and pull up a loop (3 loops on hook). Yarn over, insert hook into the following stitch, yarn over, and pull up a loop (5 loops on hook). Yarn over and pull through all 5 loops on the hook",
    abbreviation: "hdc2tog",
    video: "https://www.youtube.com/watch?v=q7CUzqHqDZk",
  },
};
