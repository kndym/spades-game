/**
 * Stub wrapper for ONNX Runtime Web inference
 * 
 * Note: ONNX Runtime Web has compatibility issues with Next.js static builds.
 * This stub allows the game to run with heuristic-based bots.
 * 
 * To enable neural network inference:
 * 1. Use a server-side API route with onnxruntime-node
 * 2. Or use a separate CDN-hosted ONNX runtime script
 */
export class ONNXModel {
  private isLoaded: boolean = false;

  /**
   * Load an ONNX model (stub - logs warning)
   */
  async load(modelPath: string): Promise<void> {
    console.warn(`ONNX model loading disabled for compatibility. Model: ${modelPath}`);
    console.warn('The game will use heuristic-based bots instead of neural networks.');
    // Don't set isLoaded to true - this will cause the bot to use fallback logic
    this.isLoaded = false;
  }

  /**
   * Run inference (stub - throws error)
   */
  async predict(inputData: Float32Array, inputShape: number[]): Promise<Float32Array> {
    throw new Error('ONNX model not available - using heuristic bots');
  }

  /**
   * Check if the model is loaded
   */
  get loaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Dispose of the model session
   */
  async dispose(): Promise<void> {
    this.isLoaded = false;
  }
}

/**
 * Model manager to handle loading all three neural networks
 */
export class ModelManager {
  nn1: ONNXModel; // Bidding network
  nn2: ONNXModel; // Playing network
  nn3: ONNXModel; // Win probability network
  
  private _isLoaded: boolean = false;

  constructor() {
    this.nn1 = new ONNXModel();
    this.nn2 = new ONNXModel();
    this.nn3 = new ONNXModel();
  }

  /**
   * Load all three models
   */
  async loadAll(basePath: string = '/models'): Promise<void> {
    try {
      console.log('Loading neural network models...');
      
      // Load models in parallel for faster startup
      await Promise.all([
        this.nn1.load(`${basePath}/nn1_model.onnx`),
        this.nn2.load(`${basePath}/nn2_model.onnx`),
        this.nn3.load(`${basePath}/nn3_model.onnx`),
      ]);

      this._isLoaded = true;
      console.log('All models loaded successfully');
    } catch (error) {
      console.error('Failed to load models:', error);
      throw new Error('Failed to load AI models. Make sure the ONNX files are in the public/models folder.');
    }
  }

  /**
   * Check if all models are loaded
   */
  get isLoaded(): boolean {
    return this._isLoaded && this.nn1.loaded && this.nn2.loaded && this.nn3.loaded;
  }

  /**
   * Dispose all models
   */
  async disposeAll(): Promise<void> {
    await Promise.all([
      this.nn1.dispose(),
      this.nn2.dispose(),
      this.nn3.dispose(),
    ]);
    this._isLoaded = false;
  }
}

// Singleton instance for global access
let modelManagerInstance: ModelManager | null = null;

export function getModelManager(): ModelManager {
  if (!modelManagerInstance) {
    modelManagerInstance = new ModelManager();
  }
  return modelManagerInstance;
}
