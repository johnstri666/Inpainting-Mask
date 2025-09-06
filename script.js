 const canvas = document.getElementById("canvas");
      const ctx = canvas.getContext("2d");
      const brushPreview = document.getElementById("brushPreview");
      const brushSlider = document.getElementById("brushSize");
      const opacitySlider = document.getElementById("brushOpacity");
      const modeIndicator = document.getElementById("mode-indicator");
      const sizeDisplay = document.getElementById("sizeDisplay");
      const opacityDisplay = document.getElementById("opacityDisplay");
      const loading = document.getElementById("loading");
      const imageUpload = document.getElementById("imageUpload");

      let image = new Image();

      let scale = 1.0;
      let isDrawing = false;
      let isErasing = false;
      let isPanning = false;
      let originX = 0,
        originY = 0;
      let offsetX = 0,
        offsetY = 0;
      let startX = 0,
        startY = 0;

      const maskCanvas = document.createElement("canvas");
      const maskCtx = maskCanvas.getContext("2d");

      let undoStack = [];
      const maxUndoSteps = 20;

      brushSlider.addEventListener("input", (e) => {
        sizeDisplay.textContent = e.target.value;
      });

      opacitySlider.addEventListener("input", (e) => {
        const opacity = Math.round(e.target.value * 100);
        opacityDisplay.textContent = opacity + "%";
      });

      // Fungsi untuk load image yang diupload
      imageUpload.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function (e) {
            image.src = e.target.result;
          };
          reader.readAsDataURL(file);
          loading.style.display = "block";
        }
      });

      function saveState() {
        const imageData = maskCtx.getImageData(
          0,
          0,
          maskCanvas.width,
          maskCanvas.height
        );
        undoStack.push(imageData);
        if (undoStack.length > maxUndoSteps) undoStack.shift();
      }

      function undo() {
        if (undoStack.length > 0) {
          const previousState = undoStack.pop();
          maskCtx.putImageData(previousState, 0, 0);
          draw();
        }
      }

      image.onload = () => {
        loading.style.display = "none";
        fitCanvasToImage();
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        saveState();
        draw();
      };

      function fitCanvasToImage() {
        const maxWidth = window.innerWidth - 40;
        const maxHeight = window.innerHeight - 40;
        const imgRatio = image.width / image.height;
        const windowRatio = maxWidth / maxHeight;

        if (imgRatio > windowRatio) {
          canvas.width = maxWidth;
          canvas.height = maxWidth / imgRatio;
        } else {
          canvas.height = maxHeight;
          canvas.width = maxHeight * imgRatio;
        }

        canvas.style.position = "absolute";
        canvas.style.left = "50%";
        canvas.style.top = "50%";
        canvas.style.transform = "translate(-50%, -50%)";
      }

      function draw() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        ctx.drawImage(maskCanvas, 0, 0);
      }

      canvas.addEventListener("mousedown", (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const [imgX, imgY] = toImageCoords(x, y);

        if (e.altKey) {
          isPanning = true;
          startX = e.clientX - offsetX;
          startY = e.clientY - offsetY;
          canvas.style.cursor = "grabbing";
        } else {
          isDrawing = true;
          // Save state before starting to draw
          saveState();
          drawCircle(imgX, imgY);
        }
      });

      canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const [imgX, imgY] = toImageCoords(x, y);
        const size = parseInt(brushSlider.value);

        if (isDrawing) {
          drawCircle(imgX, imgY);
        }
        if (isPanning) {
          offsetX = e.clientX - startX;
          offsetY = e.clientY - startY;
          draw();
        }

        updateBrushPreview(e.clientX, e.clientY, size * scale);
      });

      canvas.addEventListener("mouseup", () => {
        isDrawing = false;
        isPanning = false;
        canvas.style.cursor = "none";
      });

      canvas.addEventListener("mouseleave", () => {
        brushPreview.style.display = "none";
      });

      canvas.addEventListener("mouseenter", () => {
        brushPreview.style.display = "block";
      });

      canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const direction = e.deltaY > 0 ? 0.9 : 1.1;
        scale = Math.max(0.1, Math.min(5, scale * direction));
        draw();
      });

      function drawCircle(x, y) {
        const size = parseInt(brushSlider.value);
        const opacity = parseFloat(opacitySlider.value);

        if (isErasing) {
          maskCtx.globalCompositeOperation = "destination-out";
          maskCtx.fillStyle = `rgba(0,0,0,${opacity})`;
        } else {
          maskCtx.globalCompositeOperation = "source-over";
          maskCtx.fillStyle = `rgba(255,0,0,${opacity})`;
        }

        maskCtx.beginPath();
        maskCtx.arc(x, y, size, 0, 2 * Math.PI);
        maskCtx.fill();
        draw();
      }

      function clearMask() {
        saveState(); // Save state before clearing
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        draw();
      }

      function toggleMode() {
        isErasing = !isErasing;
        const indicator = document.getElementById("mode-indicator");

        if (isErasing) {
          indicator.innerHTML =
            '<i class="fas fa-minus-circle"></i> Erase Mode';
          indicator.className = "mode-erase";
        } else {
          indicator.innerHTML = '<i class="fas fa-plus-circle"></i> Add Mode';
          indicator.className = "mode-add";
        }
      }

      function saveMask() {
        // Create a clean mask (black background, white mask)
        const cleanMask = document.createElement("canvas");
        cleanMask.width = maskCanvas.width;
        cleanMask.height = maskCanvas.height;
        const cleanCtx = cleanMask.getContext("2d");

        // Fill with black background
        cleanCtx.fillStyle = "black";
        cleanCtx.fillRect(0, 0, cleanMask.width, cleanMask.height);

        // Get mask data and convert red areas to white
        const imageData = maskCtx.getImageData(
          0,
          0,
          maskCanvas.width,
          maskCanvas.height
        );
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 0) {
            // Red channel
            data[i] = 255; // R
            data[i + 1] = 255; // G
            data[i + 2] = 255; // B
            data[i + 3] = 255; // A
          } else {
            data[i] = 0; // R
            data[i + 1] = 0; // G
            data[i + 2] = 0; // B
            data[i + 3] = 255; // A
          }
        }

        cleanCtx.putImageData(imageData, 0, 0);

        const link = document.createElement("a");
        link.download = "mask.png";
        link.href = cleanMask.toDataURL();
        link.click();
      }

      function toImageCoords(x, y) {
        return [(x - offsetX) / scale, (y - offsetY) / scale];
      }

      function updateBrushPreview(x, y, size) {
        brushPreview.style.width = `${size * 2}px`;
        brushPreview.style.height = `${size * 2}px`;
        brushPreview.style.left = `${x - size}px`;
        brushPreview.style.top = `${y - size}px`;
        brushPreview.style.display = "block";
      }

      // Keyboard shortcuts
      document.addEventListener("keydown", (e) => {
        switch (e.key.toLowerCase()) {
          case "e":
            toggleMode();
            break;
          case "c":
            clearMask();
            break;
          case "s":
            if (e.ctrlKey) {
              e.preventDefault();
              saveMask();
            }
            break;
          case "z":
            if (e.ctrlKey) {
              e.preventDefault();
              undo();
            }
            break;
        }
      });

      // Resize handler
      window.addEventListener("resize", () => {
        if (image.complete) {
          const maxWidth = window.innerWidth - 40;
          const maxHeight = window.innerHeight - 40;
          const imgRatio = image.width / image.height;
          const windowRatio = maxWidth / maxHeight;

          if (imgRatio > windowRatio) {
            canvas.width = maxWidth;
            canvas.height = maxWidth / imgRatio;
          } else {
            canvas.height = maxHeight;
            canvas.width = maxHeight * imgRatio;
          }

          maskCanvas.width = canvas.width;
          maskCanvas.height = canvas.height;

          // Reset undo stack on resize
          undoStack = [];
          saveState();

          draw();
        }
      });
