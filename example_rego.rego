package curation.policies

import rego.v1

release := input.data

# release_evidence := [evidence | some evidence in release.evidenceConnection[_]]

artifact_evidence := [evidence.node.evidenceConnection.edges[_] | some evidence in release.artifactsConnection[_]]

# build_evidence := [evidence.evidenceConnection[_][_] | some evidence in release.fromBuilds[_]]

# all_layers_evidences := array.concat(release_evidence, array.concat(artifact_evidence, build_evidence))


default passed_tests_sufficient := false

passed_tests := [evidence.node.predicate.predicate.passedTests |
    some evidence in artifact_evidence
    evidence.node.predicateType == "https://in-toto.io/attestation/test-result/v0.1"
]

passed_tests_sufficient if {
    count(passed_tests[0]) > to_number(input.params.tests_required)
}

allow := {
	"should_allow": passed_tests_sufficient,
    "passed_tests": count(passed_tests[0]),
    "message": "Passed or not",
    "explanation": concat(" ",["Passed Tests: ", format_int(count(passed_tests[0]),10)," Required tests: ", input.params.tests_required])
}