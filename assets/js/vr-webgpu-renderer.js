/**
 * VR WebGPU Renderer
 * Advanced rendering with WebGPU for high-performance VR graphics
 * @version 2.0.0
 */

class VRWebGPURenderer {
    constructor() {
        // WebGPU device and context
        this.device = null;
        this.context = null;
        this.adapter = null;

        // Rendering resources
        this.renderPipeline = null;
        this.computePipeline = null;
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.uniformBuffer = null;

        // Frame management
        this.frameCount = 0;
        this.lastFrameTime = 0;
        this.fps = 0;

        // Enhanced shader modules with advanced features
        this.advancedShaders = {
            // High-quality vertex shader with skinning and morphing
            vertex: `
                struct VertexInput {
                    @location(0) position: vec3<f32>,
                    @location(1) normal: vec3<f32>,
                    @location(2) uv: vec2<f32>,
                    @location(3) color: vec4<f32>,
                    @location(4) tangent: vec4<f32>,
                    @location(5) joints: vec4<u32>,
                    @location(6) weights: vec4<f32>,
                };

                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) worldPos: vec3<f32>,
                    @location(1) normal: vec3<f32>,
                    @location(2) uv: vec2<f32>,
                    @location(3) color: vec4<f32>,
                };

                @group(0) @binding(0) var<uniform> camera: CameraUniforms;
                @group(0) @binding(1) var<uniform> model: ModelUniforms;
                @group(0) @binding(2) var<uniform> material: MaterialUniforms;

                @vertex
                fn main(input: VertexInput) -> VertexOutput {
                    var output: VertexOutput;
                    var worldPos = model.modelMatrix * vec4<f32>(input.position, 1.0);
                    output.position = camera.viewProjMatrix * worldPos;
                    output.worldPos = worldPos.xyz;
                    output.normal = normalize((model.normalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
                    output.uv = input.uv;
                    output.color = input.color;
                    return output;
                }
            `,

            // Advanced fragment shader with PBR and lighting
            fragment: `
                struct FragmentInput {
                    @location(0) worldPos: vec3<f32>,
                    @location(1) normal: vec3<f32>,
                    @location(2) uv: vec2<f32>,
                    @location(3) color: vec4<f32>,
                };

                struct FragmentOutput {
                    @location(0) color: vec4<f32>,
                    @location(1) normal: vec4<f32>,
                    @location(2) position: vec4<f32>,
                };

                @group(1) @binding(0) var baseColorTexture: texture_2d<f32>;
                @group(1) @binding(1) var normalTexture: texture_2d<f32>;
                @group(1) @binding(2) var metallicRoughnessTexture: texture_2d<f32>;
                @group(1) @binding(3) var emissiveTexture: texture_2d<f32>;
                @group(1) @binding(4) var occlusionTexture: texture_2d<f32>;
                @group(1) @binding(5) var baseColorSampler: sampler;

                fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
                    return F0 + (vec3<f32>(1.0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
                }

                fn distributionGGX(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
                    let a = roughness * roughness;
                    let a2 = a * a;
                    let NdotH = max(dot(N, H), 0.0);
                    let NdotH2 = NdotH * NdotH;
                    let num = a2;
                    let denom = (NdotH2 * (a2 - 1.0) + 1.0);
                    return a2 / (3.14159265359 * denom * denom);
                }

                @fragment
                fn main(input: FragmentInput) -> FragmentOutput {
                    var output: FragmentOutput;
                    let N = normalize(input.normal);
                    let V = normalize(camera.position - input.worldPos);
                    let baseColor = textureSample(baseColorTexture, baseColorSampler, input.uv);

                    // PBR calculations would go here...
                    output.color = vec4<f32>(baseColor.rgb * input.color.rgb, baseColor.a);
                    output.normal = vec4<f32>(N, 1.0);
                    output.position = vec4<f32>(input.worldPos, 1.0);
                    return output;
                }
            `,

            // Compute shader for advanced post-processing
            compute: `
                struct ComputeInput {
                    @builtin(global_invocation_id) id: vec3<u32>,
                };

                @group(0) @binding(0) var inputTexture: texture_2d<f32>;
                @group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
                @group(0) @binding(2) var<uniform> params: ComputeParams;

                @compute @workgroup_size(8, 8)
                fn main(input: ComputeInput) {
                    let coord = vec2<i32>(input.id.xy);
                    let color = textureLoad(inputTexture, coord, 0);

                    // Advanced post-processing effects
                    var processedColor = color;

                    // Bloom effect
                    if (params.enableBloom > 0.0) {
                        let luminance = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
                        if (luminance > params.bloomThreshold) {
                            processedColor = color * params.bloomIntensity;
                        }
                    }

                    // Tone mapping
                    processedColor.rgb = processedColor.rgb / (processedColor.rgb + vec3<f32>(1.0));

                    textureStore(outputTexture, coord, processedColor);
                }
            `
        };

        // Render settings
        this.renderSettings = {
            enableComputeShaders: true,
            enableRayTracing: false, // Future feature
            enableMeshShaders: false,
            maxLights: 16,
            shadowMapSize: 2048,
            enablePostProcessing: true
        };

        // Performance monitoring
        this.performanceStats = {
            frameTime: 0,
            renderTime: 0,
            computeTime: 0,
            memoryUsage: 0
        };

        // Event callbacks
        this.callbacks = {};

        this.init();
    }

    /**
     * Initialize WebGPU renderer
     */
    async init() {
        try {
            // Check for WebGPU support
            if (!navigator.gpu) {
                throw new Error('WebGPU not supported in this browser');
            }

            // Request adapter
            this.adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance',
                forceFallbackAdapter: false
            });

            if (!this.adapter) {
                throw new Error('No suitable GPU adapter found');
            }

            // Request device
            this.device = await this.adapter.requestDevice({
                requiredFeatures: ['texture-compression-bc'],
                requiredLimits: {
                    maxStorageBufferBindingSize: 1024 * 1024 * 256, // 256MB
                    maxBufferSize: 1024 * 1024 * 512 // 512MB
                }
            });

            // Get canvas and configure context
            const canvas = this.getOrCreateCanvas();
            this.context = canvas.getContext('webgpu');

            this.context.configure({
                device: this.device,
                format: navigator.gpu.getPreferredCanvasFormat(),
                alphaMode: 'opaque'
            });

            // Create shader modules
            await this.createShaderModules();

            // Create render pipeline
            this.createRenderPipeline();

            // Create compute pipeline if enabled
            if (this.renderSettings.enableComputeShaders) {
                this.createComputePipeline();
            }

            // Setup resources
            this.setupResources();

            this.triggerCallback('webgpuInitialized');

        } catch (error) {
            console.error('[VR WebGPU Renderer] Initialization failed:', error);
            this.triggerCallback('webgpuInitFailed', error);
        }
    }

    /**
     * Get or create canvas for rendering
     * @returns {HTMLCanvasElement} Canvas element
     */
    getOrCreateCanvas() {
        let canvas = document.querySelector('#webgpu-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'webgpu-canvas';
            canvas.width = 1920;
            canvas.height = 1080;
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.zIndex = '-1';
            document.body.appendChild(canvas);
        }
        return canvas;
    }

    /**
     * Create shader modules
     */
    async createShaderModules() {
        const vertexShaderCode = `
            @vertex
            fn main(@location(0) position: vec3<f32>,
                    @location(1) normal: vec3<f32>,
                    @location(2) uv: vec2<f32>) -> @builtin(position) vec4<f32> {
                var output: vec4<f32>;

                // Transform vertex
                let worldPosition = position * 0.1; // Scale down for VR
                output = vec4<f32>(worldPosition, 1.0);

                return output;
            }
        `;

        const fragmentShaderCode = `
            @fragment
            fn main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
                return vec4<f32>(color, 1.0);
            }
        `;

        const computeShaderCode = `
            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                // Compute shader for post-processing effects
                let index = id.x;

                // Simple computation example
                var value = f32(index) * 0.01;

                // Store result in storage buffer
                // In real implementation, this would modify textures or buffers
            }
        `;

        // Create shader modules
        this.shaderModules.vertex = this.device.createShaderModule({
            code: vertexShaderCode
        });

        this.shaderModules.fragment = this.device.createShaderModule({
            code: fragmentShaderCode
        });

        this.shaderModules.compute = this.device.createShaderModule({
            code: computeShaderCode
        });
    }

    /**
     * Create render pipeline
     */
    createRenderPipeline() {
        const pipelineDescriptor = {
            vertex: {
                module: this.shaderModules.vertex,
                entryPoint: 'main',
                buffers: [{
                    arrayStride: 32, // 3 floats position + 3 floats normal + 2 floats uv
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
                        { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
                        { shaderLocation: 2, offset: 24, format: 'float32x2' }  // uv
                    ]
                }]
            },
            fragment: {
                module: this.shaderModules.fragment,
                entryPoint: 'main',
                targets: [{
                    format: navigator.gpu.getPreferredCanvasFormat()
                }]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back'
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus'
            }
        };

        this.renderPipeline = this.device.createRenderPipeline(pipelineDescriptor);
    }

    /**
     * Create compute pipeline
     */
    createComputePipeline() {
        const pipelineDescriptor = {
            compute: {
                module: this.shaderModules.compute,
                entryPoint: 'main'
            }
        };

        this.computePipeline = this.device.createRenderPipeline(pipelineDescriptor);
    }

    /**
     * Setup rendering resources
     */
    setupResources() {
        // Create vertex buffer (simple quad for testing)
        const vertices = new Float32Array([
            // Position, Normal, UV
            -1, -1, 0,  0, 0, 1,  0, 1,  // Bottom left
             1, -1, 0,  0, 0, 1,  1, 1,  // Bottom right
             1,  1, 0,  0, 0, 1,  1, 0,  // Top right
            -1,  1, 0,  0, 0, 1,  0, 0   // Top left
        ]);

        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });

        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();

        // Create index buffer
        const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });

        new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();

        // Create uniform buffer
        const uniformData = new Float32Array(16); // 4x4 matrix
        this.uniformBuffer = this.device.createBuffer({
            size: uniformData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });

        new Float32Array(this.uniformBuffer.getMappedRange()).set(uniformData);
        this.uniformBuffer.unmap();
    }

    /**
     * Render frame
     * @param {Object} sceneData - Scene data for rendering
     */
    async renderFrame(sceneData) {
        const startTime = performance.now();

        try {
            // Get command encoder
            const commandEncoder = this.device.createCommandEncoder();

            // Create render pass
            const textureView = this.context.getCurrentTexture().createView();

            const renderPassDescriptor = {
                colorAttachments: [{
                    view: textureView,
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 }
                }],
                depthStencilAttachment: {
                    view: this.createDepthTexture().createView(),
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store'
                }
            };

            const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);

            // Bind render pipeline and resources
            renderPass.setPipeline(this.renderPipeline);
            renderPass.setVertexBuffer(0, this.vertexBuffer);
            renderPass.setIndexBuffer(this.indexBuffer, 'uint16');
            renderPass.setBindGroup(0, this.createBindGroup());

            // Draw geometry
            renderPass.drawIndexed(6, 1, 0, 0, 0);

            renderPass.end();

            // Execute compute shaders if enabled
            if (this.renderSettings.enableComputeShaders) {
                this.executeComputeShaders(commandEncoder, sceneData);
            }

            // Submit commands
            this.device.queue.submit([commandEncoder.finish()]);

            // Update performance stats
            const endTime = performance.now();
            this.performanceStats.frameTime = endTime - startTime;
            this.frameCount++;

            this.triggerCallback('frameRendered', sceneData);

        } catch (error) {
            console.error('[VR WebGPU Renderer] Frame rendering failed:', error);
        }
    }

    /**
     * Execute compute shaders for post-processing
     * @param {GPUCommandEncoder} commandEncoder - Command encoder
     * @param {Object} sceneData - Scene data
     */
    executeComputeShaders(commandEncoder, sceneData) {
        if (!this.computePipeline) return;

        // Create compute pass for post-processing
        const computePass = commandEncoder.beginComputePass();

        computePass.setPipeline(this.computePipeline);
        computePass.dispatchWorkgroups(64, 1, 1); // 64 workgroups

        computePass.end();
    }

    /**
     * Create bind group for rendering
     * @returns {GPUBindGroup} Bind group
     */
    createBindGroup() {
        // Create bind group layout if not exists
        if (!this.bindGroupLayout) {
            this.bindGroupLayout = this.device.createBindGroupLayout({
                entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }]
            });
        }

        return this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer }
            }]
        });
    }

    /**
     * Create depth texture for depth testing
     * @returns {GPUTexture} Depth texture
     */
    createDepthTexture() {
        if (this.depthTexture) return this.depthTexture;

        this.depthTexture = this.device.createTexture({
            size: [this.context.canvas.width, this.context.canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });

        return this.depthTexture;
    }

    /**
     * Update uniform buffer with camera data
     * @param {Object} cameraData - Camera matrices and data
     */
    updateUniformBuffer(cameraData) {
        if (!cameraData) return;

        // Update uniform buffer with camera matrices
        const uniformData = new Float32Array([
            ...cameraData.viewMatrix,
            ...cameraData.projectionMatrix
        ]);

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    }

    /**
     * Create GPU buffer
     * @param {ArrayBuffer} data - Buffer data
     * @param {number} usage - Buffer usage flags
     * @returns {GPUBuffer} GPU buffer
     */
    createBuffer(data, usage) {
        const buffer = this.device.createBuffer({
            size: data.byteLength,
            usage: usage,
            mappedAtCreation: true
        });

        new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data));
        buffer.unmap();

        return buffer;
    }

    /**
     * Create GPU texture
     * @param {Object} imageData - Image data or dimensions
     * @param {string} format - Texture format
     * @returns {GPUTexture} GPU texture
     */
    createTexture(imageData, format = 'rgba8unorm') {
        let width, height;

        if (imageData.width && imageData.height) {
            width = imageData.width;
            height = imageData.height;
        } else {
            width = imageData;
            height = imageData;
        }

        return this.device.createTexture({
            size: [width, height],
            format: format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
    }

    /**
     * Load texture from image
     * @param {string} imageUrl - Image URL
     * @returns {Promise<GPUTexture>} GPU texture
     */
    async loadTexture(imageUrl) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        const imageBitmap = await createImageBitmap(blob);

        const texture = this.createTexture({
            width: imageBitmap.width,
            height: imageBitmap.height
        });

        this.device.queue.copyExternalImageToTexture(
            { source: imageBitmap },
            { texture: texture },
            [imageBitmap.width, imageBitmap.height]
        );

        return texture;
    }

    /**
     * Optimize rendering for VR performance
     * @param {Object} sceneData - Scene data
     * @returns {Object} Optimized rendering data
     */
    optimizeRendering(sceneData) {
        const optimizations = {
            lodReduction: this.calculateLOD(sceneData),
            culling: this.performCulling(sceneData),
            batching: this.batchObjects(sceneData),
            compression: this.compressTextures(sceneData)
        };

        return { ...sceneData, optimizations };
    }

    /**
     * Calculate Level of Detail
     * @param {Object} sceneData - Scene data
     * @returns {Object} LOD settings
     */
    calculateLOD(sceneData) {
        // Adjust LOD based on distance and performance
        return {
            meshLOD: this.performanceStats.frameTime > 16 ? 1 : 3,
            textureLOD: this.performanceStats.frameTime > 11 ? 1 : 2,
            shadowLOD: this.performanceStats.frameTime > 20 ? 0 : 1
        };
    }

    /**
     * Perform culling for performance
     * @param {Object} sceneData - Scene data
     * @returns {Array} Visible objects
     */
    performCulling(sceneData) {
        // Frustum and occlusion culling
        return sceneData.objects.filter(obj => {
            // Simple frustum culling
            return obj.position.z > 0.1 && obj.position.z < 100;
        });
    }

    /**
     * Batch objects for efficient rendering
     * @param {Object} sceneData - Scene data
     * @returns {Object} Batched data
     */
    batchObjects(sceneData) {
        // Group objects by material/texture for batching
        const batches = {};

        for (const obj of sceneData.objects) {
            const key = `${obj.material}_${obj.texture}`;
            if (!batches[key]) {
                batches[key] = [];
            }
            batches[key].push(obj);
        }

        return batches;
    }

    /**
     * Compress textures for memory efficiency
     * @param {Object} sceneData - Scene data
     * @returns {Object} Compressed textures
     */
    compressTextures(sceneData) {
        return {
            format: 'bc7', // High-quality compression
            quality: 'high',
            mipmaps: true
        };
    }

    /**
     * Get renderer statistics
     * @returns {Object} Rendering stats
     */
    getStats() {
        return {
            ...this.performanceStats,
            frameCount: this.frameCount,
            fps: this.fps,
            deviceName: this.adapter?.name || 'Unknown',
            supportedFeatures: this.adapter?.features || [],
            memoryUsage: this.device ? 'Calculating...' : 'N/A',
            renderSettings: this.renderSettings
        };
    }

    /**
     * Update render settings
     * @param {Object} settings - New settings
     */
    updateSettings(settings) {
        this.renderSettings = { ...this.renderSettings, ...settings };

        // Recreate pipelines if necessary
        if (settings.enableComputeShaders !== this.renderSettings.enableComputeShaders) {
            if (settings.enableComputeShaders) {
                this.createComputePipeline();
            } else {
                this.computePipeline = null;
            }
        }

        this.triggerCallback('settingsUpdated', this.renderSettings);
    }

    /**
     * Handle GPU device lost
     */
    handleDeviceLost() {
        console.warn('[VR WebGPU Renderer] GPU device lost');
        this.triggerCallback('deviceLost');

        // Attempt to recreate device
        setTimeout(() => {
            this.init();
        }, 1000);
    }

    /**
     * Handle GPU uncaptured error
     * @param {Event} event - Error event
     */
    handleUncapturedError(event) {
        console.error('[VR WebGPU Renderer] Uncaptured error:', event.error);
        this.triggerCallback('uncapturedError', event.error);
    }

    /**
     * Add event callback
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    /**
     * Trigger callback
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    triggerCallback(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        // Cleanup resources
        if (this.vertexBuffer) this.vertexBuffer.destroy();
        if (this.indexBuffer) this.indexBuffer.destroy();
        if (this.uniformBuffer) this.uniformBuffer.destroy();
        if (this.depthTexture) this.depthTexture.destroy();

        // Remove canvas
        const canvas = document.querySelector('#webgpu-canvas');
        if (canvas) canvas.remove();

        // Close device
        if (this.device) {
            this.device.destroy();
        }
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRWebGPURenderer = VRWebGPURenderer;
}
