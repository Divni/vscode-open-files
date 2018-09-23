# Open Files for Visual Studio Code (Beta)

One day I got tired of dealing with the mess that is the Open Editors widget in vscode, so I decided to do something about
it. The result is this extension, which is really the same thing as Open Editors with the addition of sorted and grouped
files.

![Screenshot](screenshot.png)

## Known Issues

- Vscode does not have any API's to retrieve open editors, instead this addon uses a hack which isn't always reliable
  - This hack requires that it cycles through all open files when you start vscode, which isn't very reliable either but it's better than not seeing any files
  - There is a refresh option (under the widget navbar) to manually refresh the list of open files. Otherwise just switching to a file will make it appear.
  - This cannot be solved by this addon. The vscode devs have to add new API's to address this. Please add your +1 here: <https://github.com/Microsoft/vscode/issues/15178>
- Splits are not tracked very well, or in some cases at all. This is a limitation in the vscode extension API, I have yet to find a workaround.

## Missing API's and Workarounds

- No API to retrieve a list of open editors
  - Workaround:
    - On startup cycle through all open tabs (which is error-prone) and capture their "onDidChangeActiveTextEditor" event
    - While working capture onDidChangeActiveTextEditor and onDidCloseTextDocument events to build the list of open editors
  - Bug (please +1): <https://github.com/Microsoft/vscode/issues/15178>
- No "Opened Editor" or "Closed Editor" event (a text document is not an editor, they are constantly "opened" and "closed"
  as you switch tab without actually closing the tab itself)
  - Workaround:
    - When switching tabs the onDidChangeActiveTextEditor event is called before onDidCloseTextDocument. When closing a
      tab it's the inverse. Use this information to infer whether a tab was closed or just switched.
  - Bug (please +1): <https://github.com/Microsoft/vscode/issues/59159>

## Todo

- [x] Sort open files
- [x] Group open files by language
- [x] Highlight active file when switching files outside the open files tree view
- [ ] User options to sort by different fields
- [ ] User options to group by different fields
- [ ] Configurable groups (by regex), eg. sort by pattern (models, controllers, ..)
- [ ] Context menu for open files
- [ ] Navbar buttons (create file, open file, ..)
- [ ] ... ?