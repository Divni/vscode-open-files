import { assert } from 'chai';
import { OpenFiles, TreeItemGroup, TreeItemFile } from '../openfiles';
import { commands } from 'vscode';


suite("OpenFiles", function () {

    let of = new OpenFiles();

    test("OpenFiles has been initialized", function() {
        assert.isOk(of, "Open Files has been initialised");
    });

    test("Can retrieve children", async function() {
        {
            let children = await of.getChildren();
            assert.isEmpty(children, "Retrieves 0 children because we haven't opened any files yet");
        }
        
        {
            await commands.executeCommand('workbench.action.files.newUntitledFile');
            let groups = await of.getChildren();
            assert.equal(groups.length, 1, "Retrieves 1 child because we've opened one file");
            assert.instanceOf(groups[0], TreeItemGroup, "Returns a group");

            let files = await of.getChildren(groups[0]);
            assert.equal(files.length, 1, "Retrieves 1 child because we've opened one file");
            assert.instanceOf(files[0], TreeItemFile, "Returns a file");
        }
    });

    test("Children are grouped", async function() {
        await commands.executeCommand('workbench.action.files.newUntitledFile');
        await commands.executeCommand('workbench.action.files.newUntitledFile');

        let groups = await of.getChildren();
        assert.equal(groups.length, 1, "Retrieves 1 child because the other children are grouped");

        let files = await of.getChildren(groups[0]);
        assert.isAtLeast(files.length, 2, "Retrieves multiple children");
    });
});
