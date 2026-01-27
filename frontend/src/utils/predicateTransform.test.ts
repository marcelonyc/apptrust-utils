/**
 * Example test demonstrating the predicate transformation
 * 
 * Input: JSON with structure data.releaseBundleVersion.getVersion
 * Output: JSON with structure { "data": <extracted content> }
 */

const exampleInput = {
    "data": {
        "releaseBundleVersion": {
            "getVersion": {
                "createdBy": "token:marcelol@jfrog.com",
                "createdAt": "2025-11-29T18:08:10.482Z",
                "evidenceConnection": {
                    "totalCount": 2,
                    "edges": []
                }
            }
        }
    }
};

const expectedOutput = {
    "data": {
        "createdBy": "token:marcelol@jfrog.com",
        "createdAt": "2025-11-29T18:08:10.482Z",
        "evidenceConnection": {
            "totalCount": 2,
            "edges": []
        }
    }
};

console.log("Example transformation:");
console.log("Input structure: data.releaseBundleVersion.getVersion");
console.log("Output structure: { data: <content> }");
console.log("\nThis transformation is automatically applied when pasting predicates in the UI.");
