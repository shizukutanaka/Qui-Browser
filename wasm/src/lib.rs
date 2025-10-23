// WebAssembly高速化モジュール用のRustコード
// Qui Browser VRのパフォーマンスクリティカル関数を高速化

use wasm_bindgen::prelude::*;
use js_sys::{Float32Array, Float64Array};
use web_sys::console;

// 3D行列計算の高速化
#[wasm_bindgen]
pub struct MatrixMath;

#[wasm_bindgen]
impl MatrixMath {
    // 4x4行列の乗算を高速化
    pub fn multiply_matrices(
        a: &Float32Array,
        b: &Float32Array,
        result: &mut Float32Array
    ) {
        let a_data = a.to_vec();
        let b_data = b.to_vec();

        for i in 0..4 {
            for j in 0..4 {
                let mut sum = 0.0;
                for k in 0..4 {
                    sum += a_data[(i * 4 + k) as usize] * b_data[(k * 4 + j) as usize];
                }
                result.set_index((i * 4 + j) as u32, sum);
            }
        }
    }

    // ベクトルと行列の乗算を高速化
    pub fn transform_vector(
        matrix: &Float32Array,
        vector: &Float32Array,
        result: &mut Float32Array
    ) {
        let m = matrix.to_vec();
        let v = vector.to_vec();

        for i in 0..4 {
            let mut sum = 0.0;
            for j in 0..4 {
                sum += m[(i * 4 + j) as usize] * v[j as usize];
            }
            result.set_index(i, sum);
        }
    }

    // クォータニオンから回転行列を生成（高速化）
    pub fn quaternion_to_matrix(
        qx: f32, qy: f32, qz: f32, qw: f32,
        result: &mut Float32Array
    ) {
        let x2 = qx * qx;
        let y2 = qy * qy;
        let z2 = qz * qz;
        let xy = qx * qy;
        let xz = qx * qz;
        let yz = qy * qz;
        let wx = qw * qx;
        let wy = qw * qy;
        let wz = qw * qz;

        result.set_index(0, 1.0 - 2.0 * (y2 + z2));
        result.set_index(1, 2.0 * (xy - wz));
        result.set_index(2, 2.0 * (xz + wy));
        result.set_index(3, 0.0);

        result.set_index(4, 2.0 * (xy + wz));
        result.set_index(5, 1.0 - 2.0 * (x2 + z2));
        result.set_index(6, 2.0 * (yz - wx));
        result.set_index(7, 0.0);

        result.set_index(8, 2.0 * (xz - wy));
        result.set_index(9, 2.0 * (yz + wx));
        result.set_index(10, 1.0 - 2.0 * (x2 + y2));
        result.set_index(11, 0.0);

        result.set_index(12, 0.0);
        result.set_index(13, 0.0);
        result.set_index(14, 0.0);
        result.set_index(15, 1.0);
    }
}

// テキスト処理の高速化
#[wasm_bindgen]
pub struct TextProcessor;

#[wasm_bindgen]
impl TextProcessor {
    // 高速文字列検索（ボイヤー・ムーア法）
    pub fn boyer_moore_search(text: &str, pattern: &str) -> i32 {
        if pattern.is_empty() {
            return 0;
        }
        if text.len() < pattern.len() {
            return -1;
        }

        let text_chars: Vec<char> = text.chars().collect();
        let pattern_chars: Vec<char> = pattern.chars().collect();

        // バッドキャラクターシフトテーブルを作成
        let mut bad_char = std::collections::HashMap::new();
        for (i, &ch) in pattern_chars.iter().enumerate() {
            bad_char.insert(ch, i);
        }

        let mut i = 0usize;
        while i <= text_chars.len() - pattern_chars.len() {
            let mut j = pattern_chars.len() - 1;

            while j > 0 && text_chars[i + j] == pattern_chars[j] {
                j -= 1;
            }

            if text_chars[i + j] == pattern_chars[j] {
                return i as i32;
            } else {
                let bad_char_shift = bad_char.get(&text_chars[i + j]).unwrap_or(&pattern_chars.len());
                let good_suffix_shift = j;
                i += std::cmp::max(*bad_char_shift, good_suffix_shift);
            }
        }

        -1
    }

    // 高速テキスト正規化
    pub fn normalize_text(text: &str) -> String {
        use unicode_normalization::UnicodeNormalization;

        text.nfkc()
            .flat_map(|ch| ch.to_string().chars())
            .collect::<String>()
            .to_lowercase()
    }

    // キーワード抽出の高速化
    pub fn extract_keywords(text: &str, max_keywords: usize) -> Vec<String> {
        use std::collections::HashMap;

        let normalized = Self::normalize_text(text);
        let words = normalized.split_whitespace()
            .filter(|word| word.len() > 3)
            .map(|word| word.to_string())
            .collect::<Vec<_>>();

        let mut frequency = HashMap::new();
        for word in words {
            *frequency.entry(word).or_insert(0) += 1;
        }

        let mut sorted_words: Vec<_> = frequency.iter().collect();
        sorted_words.sort_by(|a, b| b.1.cmp(a.1));

        sorted_words.iter()
            .take(max_keywords)
            .map(|(word, _)| word.clone())
            .collect()
    }
}

// データ圧縮の高速化
#[wasm_bindgen]
pub struct DataCompressor;

#[wasm_bindgen]
impl DataCompressor {
    // LZ4風の高速圧縮アルゴリズム
    pub fn fast_compress(data: &[u8]) -> Vec<u8> {
        if data.len() < 16 {
            return data.to_vec();
        }

        let mut compressed = Vec::new();
        let mut i = 0;

        while i < data.len() {
            let mut match_length = 0;
            let mut match_offset = 0;

            // 辞書検索（簡易版）
            for j in 0..std::cmp::min(i, 4096) {
                let mut length = 0;
                while i + length < data.len()
                      && j + length < i
                      && data[i + length] == data[j + length] {
                    length += 1;
                    if length >= 15 {
                        break;
                    }
                }

                if length > match_length {
                    match_length = length;
                    match_offset = i - j;
                }
            }

            if match_length >= 3 {
                // マッチが見つかった場合
                compressed.push(0x80 | (match_length - 3));
                compressed.push((match_offset >> 8) as u8);
                compressed.push((match_offset & 0xFF) as u8);
                i += match_length;
            } else {
                // リテラル
                let literal_length = std::cmp::min(15, data.len() - i);
                compressed.push(literal_length as u8);
                for j in 0..literal_length {
                    compressed.push(data[i + j]);
                }
                i += literal_length;
            }
        }

        compressed
    }

    // 高速デルタエンコーディング
    pub fn delta_encode(data: &Float32Array) -> Vec<u8> {
        let values: Vec<f32> = data.to_vec();
        let mut deltas = Vec::new();
        let mut last_value = 0.0f32;

        for &value in &values {
            let delta = (value - last_value) as i16;
            deltas.push(delta);
            last_value = value;
        }

        // デルタ値をバイト配列に変換
        deltas.iter()
            .flat_map(|&delta| delta.to_le_bytes().to_vec())
            .collect()
    }

    // 高速デルタデコーディング
    pub fn delta_decode(data: &[u8], result: &mut Float32Array) {
        let mut deltas = Vec::new();
        for i in (0..data.len()).step_by(2) {
            if i + 1 < data.len() {
                let delta = i16::from_le_bytes([data[i], data[i + 1]]);
                deltas.push(delta);
            }
        }

        let mut current_value = 0.0f32;
        for (i, &delta) in deltas.iter().enumerate() {
            current_value += delta as f32;
            result.set_index(i as u32, current_value);
        }
    }
}

// WebAssemblyエントリーポイント
#[wasm_bindgen(start)]
pub fn main() {
    console::log_1(&"WebAssembly module for Qui Browser VR loaded!".into());
}
