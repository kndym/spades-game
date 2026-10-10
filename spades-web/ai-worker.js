import { chooseAction } from "./ai.js";
self.onmessage = ({ data }) => {
  try {
    const result = chooseAction(data.observation, {
      difficulty: data.difficulty,
    });
    self.postMessage({ id: data.id, ...result });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
