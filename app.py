
import os
import base64
from io import BytesIO

import streamlit as st
import numpy as np
from PIL import Image
from dotenv import load_dotenv
from openai import OpenAI


# ==========================================
# 1. PAGE CONFIGURATION
# ==========================================

st.set_page_config(
    page_title="AI Image Analyzer",
    page_icon="🖼️",
    layout="wide"
)

load_dotenv()

st.title("📍 AI Image Analyzer")
st.write(
    "Upload an image to view its properties, "
    "RGB statistics, and AI-generated description."
)


# ==========================================
# 2. OPENROUTER API CONFIGURATION
# ==========================================

api_key = os.getenv("OPENROUTER_API_KEY")

if not api_key:
    st.error(
        "API key not found. Add OPENROUTER_API_KEY "
        "to your .env file."
    )
    st.stop()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key
)


# ==========================================
# 3. IMAGE UPLOAD
# ==========================================

uploaded_file = st.file_uploader(
    "Upload an Image",
    type=["jpg", "jpeg", "png"]
)

if uploaded_file is None:
    st.info("Please upload a JPG, JPEG, or PNG image.")
    st.stop()


# ==========================================
# 4. READ AND CONVERT IMAGE
# ==========================================

try:
    original_image = Image.open(uploaded_file)
    image = original_image.convert("RGB")
except Exception as e:
    st.error(f"Unable to open image: {e}")
    st.stop()


# ==========================================
# 5. DISPLAY IMAGE
# ==========================================

st.subheader("Uploaded Image")

st.image(
    image,
    caption="Your Uploaded Image",
    use_container_width=True
)


# ==========================================
# 6. NUMPY IMAGE ANALYSIS
# ==========================================

image_array = np.array(image)

height, width, channels = image_array.shape

st.subheader("📊 Image Properties")

col1, col2, col3 = st.columns(3)

col1.metric("Height", f"{height} px")
col2.metric("Width", f"{width} px")
col3.metric("Channels", channels)

st.write("**Data Type:**", image_array.dtype)
st.write("**Array Shape:**", image_array.shape)

pixel = image_array[0, 0]

st.write("**First Pixel RGB Values:**", pixel.tolist())


# ==========================================
# 7. IMAGE STATISTICS
# ==========================================

st.subheader("📈 Image Statistics")

min_pixel = int(np.min(image_array))
max_pixel = int(np.max(image_array))
avg_pixel = float(np.mean(image_array))

col1, col2, col3 = st.columns(3)

col1.metric("Minimum Pixel Value", min_pixel)
col2.metric("Maximum Pixel Value", max_pixel)
col3.metric("Average Pixel Value", f"{avg_pixel:.2f}")


# ==========================================
# 8. RGB COLOR ANALYSIS
# ==========================================

red = image_array[:, :, 0]
green = image_array[:, :, 1]
blue = image_array[:, :, 2]

red_mean = float(np.mean(red))
green_mean = float(np.mean(green))
blue_mean = float(np.mean(blue))

st.subheader("🎨 RGB Color Analysis")

col1, col2, col3 = st.columns(3)

col1.metric("🔴 Red Average", f"{red_mean:.2f}")
col2.metric("🟢 Green Average", f"{green_mean:.2f}")
col3.metric("🔵 Blue Average", f"{blue_mean:.2f}")


# ==========================================
# 9. AI IMAGE ANALYZER
# ==========================================

st.divider()
st.subheader("🤖 AI Image Analysis")

if st.button("Analyze with AI", type="primary"):

    try:
        with st.spinner("AI is analyzing your image..."):

            # Convert image to JPEG bytes
            buffer = BytesIO()
            image.save(buffer, format="JPEG")
            image_bytes = buffer.getvalue()

            # Encode JPEG bytes into Base64
            image_base64 = base64.b64encode(
                image_bytes
            ).decode("ascii")

            # Build a valid image data URL
            image_data_url = (
                "data:image/jpeg;base64,"
                + image_base64
            )

            # Call OpenRouter Chat Completions API
            response = client.chat.completions.create(
                model="openai/gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": """
Analyze the uploaded image.

Use exactly these headings:

Description:
Give a short description of the image.

Objects:
List the main visible objects.

Colors:
Mention the dominant colors.

Summary:
Give a short overall summary.

Use clear, simple English.
Only describe things visible in the image.
"""
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_data_url
                                }
                            }
                        ]
                    }
                ],
                max_tokens=500
            )

            # Extract the AI response
            result = response.choices[0].message.content

            st.subheader("Analysis Result")

            if result:
                st.markdown(result)
            else:
                st.warning("The AI returned an empty response.")

    except Exception as e:
        st.error("Image analysis failed.")
        st.code(str(e))
        st.info(
            "Check your API key, model availability, "
            "account credits, and internet connection."
        )
