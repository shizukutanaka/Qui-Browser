/**
 * VR Math Utilities - Shared mathematical functions
 * ================================================
 * Centralized math operations used across multiple modules
 * Eliminates 200+ lines of duplicate code
 *
 * Functions:
 * - cosineSimilarity: Vector similarity (single implementation)
 * - softmax: Probability normalization
 * - normalizeVector: L2 normalization
 * - dotProduct: Vector multiplication
 * - distance: Euclidean distance
 * - linearInterpolation: Smooth transitions
 * - clamp: Value bounds checking
 */

class VRMathUtils {
  /**
   * Calculate cosine similarity between two vectors
   * Used in: P7-1, P7-2, P6-3 (3 previous implementations)
   */
  static cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      const v1 = vec1[i] || 0;
      const v2 = vec2[i] || 0;
      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    return norm1 > 0 && norm2 > 0 ? dotProduct / (norm1 * norm2) : 0;
  }

  /**
   * Softmax normalization for probability distributions
   * Used in: P7-2, P6-3 (2 previous implementations)
   */
  static softmax(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return [];
    }

    const maxVal = Math.max(...values);
    const exps = values.map(v => Math.exp(v - maxVal));
    const sumExps = exps.reduce((sum, val) => sum + val, 0);

    return sumExps > 0 ? exps.map(exp => exp / sumExps) : values.map(() => 1 / values.length);
  }

  /**
   * L2 normalization of vector
   * Used in: P7-1, P6-1 (2 previous implementations)
   */
  static normalizeVector(vector) {
    if (!Array.isArray(vector) || vector.length === 0) {
      return vector;
    }

    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? vector.map(v => v / norm) : vector;
  }

  /**
   * Dot product of two vectors
   */
  static dotProduct(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return 0;
    }

    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += (vec1[i] || 0) * (vec2[i] || 0);
    }
    return sum;
  }

  /**
   * Euclidean distance between two points
   */
  static distance(point1, point2) {
    if (!point1 || !point2 || point1.length !== point2.length) {
      return 0;
    }

    let sum = 0;
    for (let i = 0; i < point1.length; i++) {
      const diff = (point1[i] || 0) - (point2[i] || 0);
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Linear interpolation
   */
  static lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  /**
   * Clamp value to range
   */
  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Matrix multiplication for small matrices
   */
  static matrixMultiply(matA, matB) {
    if (!matA || !matB || matA[0].length !== matB.length) {
      return matA; // Fallback to identity-like operation
    }

    const rows = matA.length;
    const cols = matB[0].length;
    const result = Array(rows).fill(null).map(() => Array(cols).fill(0));

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        for (let k = 0; k < matB.length; k++) {
          result[i][j] += matA[i][k] * matB[k][j];
        }
      }
    }

    return result;
  }

  /**
   * Gaussian random number (Box-Muller transform)
   */
  static gaussianRandom(mean = 0, stddev = 1) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stddev;
  }

  /**
   * Laplace noise for differential privacy
   */
  static laplaceNoise(mu = 0, scale = 1) {
    const u = Math.random() - 0.5;
    return mu - scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Sigmoid activation
   */
  static sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * ReLU activation
   */
  static relu(x) {
    return Math.max(0, x);
  }

  /**
   * Tanh activation
   */
  static tanh(x) {
    return Math.tanh(x);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRMathUtils;
}
