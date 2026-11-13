# Deploying NexusVista on Streamlit Community Cloud

Nothing in api/, templates/ or static/ changes. This adds:

    .streamlit/config.toml           <- Streamlit settings (dark background, no menu)
    streamlit_deploy/streamlit_app.py <- runs your page + backend inside Streamlit
    streamlit_deploy/requirements.txt <- streamlit, flask, biopython

The root requirements.txt is left alone, so a Vercel setup keeps working.

## Test locally (from the repo root)

    pip install -r streamlit_deploy/requirements.txt
    streamlit run streamlit_deploy/streamlit_app.py

## Deploy

1. Commit and push these files to GitHub.
2. Go to https://share.streamlit.io -> Create app -> pick this repo, branch main.
3. Main file path: streamlit_deploy/streamlit_app.py
4. Deploy.

`python api/app.py` still runs the Flask version as before.
