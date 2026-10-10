# Publish TAMS Connect on GitHub Pages

This folder contains the complete website, already built. You do not need an API key, server, ChatGPT account, or a build service to publish it.

1. Create a GitHub repository, for example `tams-connect`. A public repository works with GitHub Pages on GitHub Free.
2. Open the repository and choose **Add file > Upload files**. Open this folder on your computer and upload its **contents**, not the enclosing `TAMS-Connect-GitHub` folder. Include the subfolders. The repository's top level must contain `index.html`, `assets`, `brand`, and `clubs`.
3. Commit the uploaded files to `main`. If you downloaded the ZIP, extract it first; uploading the ZIP itself will not publish the website.
4. Open **Settings > Pages**. Under **Build and deployment**, select **Deploy from a branch**, choose **main** and **/(root)**, then **Save**.
5. Wait for GitHub to finish deployment, then use the website link shown on that page. It will normally look like `https://YOUR-USERNAME.github.io/tams-connect/`.

Test Home, Clubs, Events, and Messages. Internal links use `#/...`, so page refreshes work without a server. The repository itself displays the code; GitHub Pages supplies the website address.

The `.nojekyll` file is included to publish the prepared static files directly. Enable hidden-file visibility if your file picker hides it. Do not upload the original TAMS workspace, private configuration files, or `node_modules`.

## What visitors get

Every visitor starts with fictional demo accounts and activity. Posts, messages, uploaded photos, and other changes stay in that visitor's browser. Switching profiles explores both sides of the same local demo. Visitors do not share a real student network or register accounts.

## Making changes later

The ready-to-publish files are at the folder's top level. Editable code is in `src`, original assets in `public`, and instructions are in [README.md](README.md). Editing source requires running `npm run build` and uploading the rebuilt files.

GitHub's instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
